/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
//d3
import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;
import ISelectionManager = powerbi.extensibility.ISelectionManager; // added for selections
import ISelectionId = powerbi.visuals.ISelectionId; //added for selections
import IVisualHost = powerbi.extensibility.visual.IVisualHost; // added for selections

import {
    select as d3Select
} from "d3-selection";

//to populate the formatting pane
import { VisualSettings } from "./settings";

//added for list of colours
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import Fill = powerbi.Fill;

export class Visual implements IVisual {
    private settings: VisualSettings;
    private svg: Selection<SVGElement>; 
    private recSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    //added for selections
    private selectionManager: ISelectionManager;
    private host: IVisualHost;
    map2: powerbi.data.Selector[][];
    
    constructor(options: VisualConstructorOptions) {
        this.svg = d3.select(options.element)
            .append('svg')
        this.host = options.host; //added for selections        
        this.selectionManager = this.host.createSelectionManager(); // added for selections        
    }

    public update(options: VisualUpdateOptions) {
        //console.log(options);
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

        // set viewport width to the svg where our rectangles reside
        let width: number = options.viewport.width;
        let height: number = options.viewport.height;
        this.svg.attr("width", width);
        this.svg.attr("height", height);

        //add index positions to the values
        let DV = options.dataViews
        let category = DV[0].categorical.categories[0];
        let vals = category.values;
        let measurevals = DV[0].categorical.values[0];
        this.map2 = vals.map(function (element, index) {
            let selectionId: ISelectionId = this.host.createSelectionIdBuilder()
                .withCategory(category, index)
                .createSelectionId();
            let co = (category.objects) ? category.objects[index] ? String(<Fill>(category.objects[index].colorSelector.fill['solid']['color'])) : "#FF0000" : "#FF0000"; //objects is initially not present
            let hl = (measurevals.highlights) ? (measurevals.highlights[index]) ? "Y" : "N" : "N";
            return [index, element, selectionId, co, selectionId.getSelector(), hl]
        }, this) //add index of value
        let l = this.map2.length;
        //console.log(this.map2);
        // Rectangles
        this.recSelection = this.svg
            .selectAll('.rect')
            .data(this.map2); // map data, with indexes, to svg element collection
        const recSelectionMerged = this.recSelection
            .enter()
            .append('rect')
            .classed('rect', true);

        this.svg.selectAll('.rect')            
            .transition()
            .duration(1000)
            .attr("x", (d) => width / (l + 1) * (d[0] + 1)) //width devided by number of kpis for x position
            .attr("y", (d) => {
                let extra = d[5] == "Y" ? 100 : 0;
                return height / 2 - extra
            })
            .attr("width", 50)
            .attr("height", 50)
            .style("fill", (d) => d[3])
            .style("fill-opacity", 0.8);

        //this.svg.selectAll('.rect').style("fill", (d)=> d[3])

        //pass SelectionId to the selectionManager
        recSelectionMerged.on('click', (d) => {
            this.selectionManager.select(d[2]).then((ids: ISelectionId[]) => {
                //for all rectangles do
                recSelectionMerged.each(function (d) {
                    // if the selection manager returns no id's, then opacity 0.9,
                    // if the element s matches the selection (ids), then 0.7 else 0.3
                    let op = !ids.length ? 0.9 : d[2] == ids[0] ? 0.7 : 0.3
                    d3Select(this) //this is the element
                        .transition()
                        .style("fill-opacity", op)
                        .duration(1000)
                })
            })
        })

    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
       //return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];
        
        switch (objectName) {
            case 'colorSelector':
                for (let barDataPoint of this.map2) {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: String(barDataPoint[1]),
                        properties: {
                            fill: {
                                solid: {
                                    color: String(barDataPoint[3])
                                }
                            }
                        },
                        propertyInstanceKind: {
                            fill: VisualEnumerationInstanceKinds.ConstantOrRule // allows conditional (rule) formatting
                        },
                        altConstantValueSelector: barDataPoint[4],  //needed to get all selections
                        selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals)
                    });
                }
                return objectEnumeration;
        }
    
    }
}