/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */
Class.create("GraphsViewer", AbstractEditor, {


    queriesData: null,
    charts: null,
    defaultCount:25,

    initialize: function($super, oFormObject, editorOptions)
    {
        editorOptions = Object.extend({
            fullscreen:false
        }, editorOptions);
        $super(oFormObject, editorOptions);
        this.charts = $A();

    },

    destroy: function(){
        // TODO: Shall we destroy the SVG objects?
    },

    open : function($super, node){
        $super(node);
        this.node = node;
        this.loadQueries();
    },

    loadQueries : function(){
        var conn = new Connexion();
        conn.setParameters($H({
            get_action: 'analytic_list_queries'
        }));
        conn.onComplete = function(transport){
            this.parseAndLoadQueries(transport.responseJSON);
        }.bind(this);
        conn.sendAsync();
    },

    parseAndLoadQueries: function(queriesData){
        $('graph_viewer_box').update('');
        this.queriesData = $A(queriesData);
        this.queriesData.each(function(qData){
            var div;
            if(qData['SEPARATOR']){
                div = new Element('div', {class:'tabrow'}).update('<li class="selected">' + qData['LABEL'] + '</li>');
                this.element.insert(div);
                return;
            }
            div = new Element('div', {id:qData['NAME']+'_container'});
            this.element.insert(div);
            div.insert({top:('<div class="innerTitle">'+qData['LABEL']+'</div>')});
            div.insert(('<div style="text-align: center; padding:100px;">Loading...</div>'));
            this.loadData(qData['NAME']);
        }.bind(this));
    },

    getQueryByName: function(queryName){
        return this.queriesData.detect(function(q){
            return q['NAME'] == queryName;
        });
    },

    loadData : function(queryName, chart, start, count){
        var conn = new Connexion();
        if(!start) start = 0;
        if(!count) count = this.defaultCount;
        conn.setParameters($H({
            get_action: 'analytic_query',
            query_name: queryName,
            start:start,
            count:count
        }));
        conn.onComplete = function(transport){
            if(chart){
                this.updateChart(chart, queryName, transport.responseJSON);
            }else{
                this.createChart(queryName, transport.responseJSON);
            }
        }.bind(this);
        conn.sendAsync();
    },

    createChart : function(queryName, jsonData){
        var qData = this.getQueryByName(queryName);
        var div = this.element.down("#"+queryName+'_container');
        div.update('');
        if(qData['AXIS']){
            var svg = dimple.newSvg("#"+queryName+'_container', '100%', 300);
            var chart = new dimple.chart(svg, jsonData['data']);
            chart.addCategoryAxis("x", qData['AXIS']['x']);
            chart.addMeasureAxis("y", qData['AXIS']['y']);
            chart.defaultColors[0] = new dimple.color("#399C9B");
            chart.setMargins(80, 20, 40, 80);
            chart.addSeries(null, dimple.plot.line);
            chart.draw();
            div.insert({top:('<div class="innerTitle">'+qData['LABEL']+'</div>')});
            this.updateLinks(chart, queryName, jsonData);
            this.charts.push(chart);
        }else if(qData["FIGURE"]){

        }
    },

    updateChart : function(chart, queryName, jsonData){
        chart.data = jsonData["data"];
        chart.draw();
        this.updateLinks(chart, queryName, jsonData);
    },

    updateLinks : function(chart, queryName, jsonData){

        var container = this.element.down('#' + queryName+'_container');
        var linkCont = container.down('.chart_links');
        if(!linkCont){
            linkCont = new Element('div', {className:'chart_links', style:'float: right;margin: 10px 20px;'});
            container.insert({top:linkCont});
        }else{
            linkCont.update('');
        }

        $A(["last", "next", "previous", "first"]).each(function(relName){
            var linkData = jsonData['links'].detect(function(l){
                return (l['rel'] == relName);
            });
            if(linkData){
                var a = this.createLink(queryName, linkData, chart);
            }else{
                var a = this.createLink(queryName, relName, chart);
            }
            linkCont.insert(a);
        }.bind(this));
    },

    createLink: function(queryName, linkData, chart){
        var label;
        var rel;
        var linkActive = false;
        if(Object.isString(linkData)){
            rel = linkData;
        }else{
            linkActive = true;
            rel = linkData["rel"];
        }
        switch(rel){
            case "next":
                label = "icon-backward";
                break;
            case "previous":
                label = "icon-forward";
                break;
            case "last":
                label = "icon-fast-backward";
                break;
            case "first":
                label = "icon-fast-forward";
                break;
        }
        var link = new Element('a').update("<a class='"+label+"' style='display:inline-block; margin: 0 5px;"+(linkActive?"cursor:pointer;color:#399C9B;":"color:#CCCCCC;")+"'></a>");
        if(!Object.isString(linkData)){
            link.observe("click", function(){
                this.loadData(queryName, chart, linkData['cursor'], linkData['count']);
            }.bind(this));
        }
        return link;
    },

    updateTitle: function(label){
        this.element.down("span.header_label").update("<span class='icon-puzzle-piece'></span> " + label);
        this.element.fire("editor:updateTitle", "<span class='icon-puzzle-piece'></span> " + label);
    },

    /**
     * Resizes the main container
     * @param size int|null
     */
    resize : function(size){
        if(size){
            fitHeightToBottom(this.element);
        }else{
            fitHeightToBottom(this.element);
        }
        this.element.select('svg').each(function(chart){
            //chart.setStyle('width')
        });
        this.charts.each(function(c){
            c.draw();
        });
        this.element.fire("editor:resize", size);
    },

    isDirty : function(){
        return false;
    }

});