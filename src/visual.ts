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


import { VisualSettings } from "./settings";
export class Visual implements IVisual {
    private settings: VisualSettings;
    private svg: Selection<SVGElement>; 
    private recSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    //added for selections
    private selectionManager: ISelectionManager;
    private host: IVisualHost;

    constructor(options: VisualConstructorOptions) {
        this.svg = d3.select(options.element)
            .append('svg')
        this.host = options.host; //added for selections        
        this.selectionManager = this.host.createSelectionManager(); // added for selections
    }

    public update(options: VisualUpdateOptions) {
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        this.svg.selectAll("rect").remove(); //remove all rectangles 
        // set viewport width to the svg where our rectangles reside
        let width: number = options.viewport.width;
        let height: number = options.viewport.height;
        this.svg.attr("width", width);
        this.svg.attr("height", height);

        //add index positions to the values
        let DV = options.dataViews
        let category = DV[0].categorical.categories[0];
        let vals = category.values;

        const map2 = vals.map(function (element, index) {            
            let selectionId: ISelectionId = this.host.createSelectionIdBuilder()
                .withCategory(category, index)
                .createSelectionId();
            return [index, element, selectionId]            
        }, this) //add index of value
        let l = map2.length;
        
        // Rectangles
        this.recSelection = this.svg
            .selectAll('.rect')
            .data(map2); // map data, with indexes, to svg element collection
        const recSelectionMerged = this.recSelection
            .enter()
            .append('rect')
            .classed('rect', true);

        recSelectionMerged
            .attr("x", (d) => width / (l + 1) * (d[0] + 1)) //width devided by number of kpis for x position
            .attr("y", height / 2)
            .attr("width", 50)
            .attr("height", 50)
            .style("fill", "black")
            .style("fill-opacity", 0.5);

        //pass SelectionId to the selectionManager
        recSelectionMerged.on('click', (d) => {
            this.selectionManager.select(d[2]).then((ids: ISelectionId[]) => {
                //for all rectangles do
                recSelectionMerged.each(function (s) {
                    // if the selection manager returns no id's, then opacity 0.9,
                    // if the element s matches the selection (ids), then 0.7 else 0.3
                    let op = !ids.length ? 0.9 : s[2] == ids[0] ? 0.7 : 0.3                    
                    d3Select(this)
                        .transition()
                        .style("fill-opacity", op)
                        .duration(1000)                    
                })                
            })
        })

        recSelectionMerged
            .exit()
            .remove();

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
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}