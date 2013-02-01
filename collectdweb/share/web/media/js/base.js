
// Collectd-web - base.js
// Copyright (C) 2009-2010  Kenneth Belitzky
// 
// This program is free software; you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation; either version 2 of the License, or (at your option) any later
// version.
// 
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
// details.
// 
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc.,
// 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

/*jshint browser: true */
/*global Backbone: false, $: false, _:false, Mustache: false */

(function(window) {
    "use strict";
    var GraphView= window.GraphView;
    var addTime = window.addTime;

    var getUrlPairs = function( list ) {
        return _.map( list.sort(), function(url) {
            return {
                url: url,
                name: _.chain( url.split('/')).compact().last().value()
            };
        });
    };

    var MenuTabs = Backbone.View.extend({
        events : {
            'click #slide-menu-btn': 'slide'
        },
        initialize: function() {
            this.setElement( '#slide-menu-container');
            this.$('#menu-tabs').tabs();
            this.options = new OptionsTab();
        },
        slide: function(ev) {
            this.$('#slide-menu-content').slideToggle('fast');
            $(ev.currentTarget).toggleClass('active');
            return false;
        }
    });
    /* tipsy up in this bitch
       $('.ttip').hover(function () {
       var text = $(this).find('div.ttip-content').html();
       $('#help-box').html(text).fadeIn();
       }, function () {
       $('#help-box').html('').hide();
       });
       */
    var LoadingIndicator = Backbone.View.extend({
        initialize: function() {
            this.setElement('#loading');
            this.$el
            .ajaxStart( this.show.bind(this))
            .ajaxStop(function () {
                $(this).hide();
                //$('.sortable').sortable();
                //grid-view change
            });
        },
        show : function() {
            this.$el.show();
        }
    });
    var HostsView = Backbone.View.extend({
        template : Mustache.compile(
            '{{#hosts}}' +
            '<li>' +
            '<a href="{{url}}">{{ name }}</a>' +
            '</li>' +
            '{{/hosts}}'
        ),
        events: {
            'keyup #host-filter' : 'filter',
            'click a': 'selectHost'
        },
        initialize: function() {
            this.setElement('#hosts');
            this.plugins = new PluginsView();

            this.plugins.on( 'got-graphes', this.gotGraphes, this);

            Backbone.ajax({
                url : '/hosts/'
            }).done( this.gotHosts.bind( this));
        },
        gotHosts: function( hosts ) {
            this.$('ul').empty().append( this.template({ hosts : getUrlPairs( hosts) }));
        },
        filter: function(ev) {
            var target = $(ev.currentTarget);
            var search = target.val();
            if ( search === '') {
                this.$('li').show();
            } else {
                this.$('li').each(function(i,e) {
                    var element = $(e);
                    if ( element.text().toLowerCase().indexOf( search) === -1) {
                        element.hide();
                    } else {
                        element.show();
                    }
                });
            }
            target.focus();
            return true;
        },
        selectHost: function( ev) {
            this.$('a').removeClass('selected');

            var target = $(ev.currentTarget);
            target.addClass('selected');
            var host = target.attr('href');
            this.host = host;

            this.plugins.listHost( host);
            return false;
        },
        gotGraphes: function(graphes) {
            this.trigger( 'show-graphes', graphes);
        }
    });
    var PluginsView = Backbone.View.extend({
        initialize: function() {
            this.setElement("#plugins");
        },
        events: {
            'click ul li a': 'selectPlugin'
        },
        template: Mustache.compile(
            '<div>' +
            '<div class="ui-widget-header ui-corner-top"><h3>Available Plugins</h3></div>' +
            '<div id="plugin-container" class="ui-widget-content ui-corner-bottom  ">' +
            '<ul>{{#plugins}}' +
            '<li><a href="{{url}}" >{{name}}</a></li>' +
            '{{/plugins}}</ul>' +
            '</div>' +
            '</div>'
        ),
        listHost: function( host ){
            Backbone.ajax({
                url: host,
                data: {
                    group:'-'
                }
            }).done( this.gotPlugins.bind( this));
        },
        gotPlugins: function( plugins ) {
            this.$el.empty().append( this.template({ plugins: getUrlPairs( plugins) }));
        },
        selectPlugin: function(ev) {
            var target = $(ev.currentTarget);
            this.$('a').removeClass('selected');
            target.addClass('selected');

            var url = target.attr('href');
            Backbone.ajax({
                url : url
            }).done( this.gotGraphes.bind(this));
            return false;
        },
        gotGraphes: function( graphes ) {
            this.trigger('got-graphes', graphes);
        }
    });
    var Ruler = Backbone.View.extend({
        initialize: function() {
            this.setElement('#ruler');
            this.$el.draggable({
                axis: 'x'
            });
        },
        show: function() {
            this.$el.fadeIn();
        },
        hide: function() {
            this.$el.fadeOut();
        }
    });
    var OptionsTab = Backbone.View.extend({
        events : {
            'click #show-ruler-checkbox': 'toggleRuler',
            'change #graph-view' : 'changeGridView',
            'click #graph-caching-checkbox': 'toggleLazy'
        },
        initialize: function() {
            this.setElement('#options-tab');
        },
        toggleRuler: function(ev) {
            var target = $(ev.currentTarget);
            this.trigger( 'set-ruler', target.prop('checked') );
        },
        toggleLazy: function( ev) {
            var target = $(ev.currentTarget);
            this.trigger( 'set-lazy', target.prop('checked') );
        },
        changeGridView: function( ev) {
            var target = $(ev.currentTarget);
            this.trigger( 'change-grid-view', target.val());
        }
    });
    var GraphDefTab = Backbone.View.extend({
        events : {
            'click #load-graphdefs' : 'loadDefinitions',
            'change #graphdef-name' : 'changeGraphDef'
        },
        loadDefinitions: function () {
            this.setElement( 'graphdefs-tab');
            Backbone.ajax({
                'url' : '/graphdefs/'
            }).done( this.gotDefinitions.bind(this));
        },
        template : Mustache.compile(
            '{{#names}}' +
            '<option value="{{.}}" >{{.}}</option>' +
            '{{/names}}'
        ),
        gotDefinitions: function(definitions) {
            this.definitions = definitions;
            $('#graphdef-name').append( this.template({ names : definitions }));
        },
        changeGraphDef: function( ev ) {
            var target = $(ev.currentTarget);
            var values = this.definitions[ target.val() ];
            if ( ! values) {
                return;
            }
            this.$('#graphdef-content').val(values.join('\n'));
        }
    });
    var EffectsView = Backbone.View.extend({
        events : {
            'mouseenter .icons' : 'addHoverEffect',
            'mouseleave .icons' : 'dropHoverEffect'
        },
        initialize: function() {
            this.setElement( 'body');
            this.$('button').button();
            if( navigator.platform === 'iPad' ||
               navigator.platform === 'iPhone' ||
                   navigator.platform === 'iPod') {
                this.ipadWorkArround();
            }
        },
        dropHoverEffect: function( ev) {
            $(ev.currentTarget).removeClass('ui-state-hover');
        },
        addHoverEffect: function( ev) {
            $(ev.currentTarget).addClass('ui-state-hover');
        },
        ipadWorkArround: function() {
            $( window ).scroll( function () {
                $( "#toolbar-container" ).css(
                    "top", ( $( window ).height() + $( document ).scrollTop() - 30 ) +"px"
                );  
            });
        }
    });

    var MainView = Backbone.View.extend({
        initialize: function() {
            this.effects = new EffectsView();
            this.menu = new MenuTabs();
            this.ruler = new Ruler();
            this.status = new StatusBar();
            this.error = new ErrorView();
            this.grid = new GridView();
            this.hosts = new HostsView();

            this.menu.options.on('change-grid-view', this.grid.setView, this.grid);
            this.menu.options.on('set-ruler', this.toggleRuler, this);
            this.menu.options.on('set-lazy', this.grid.setLazy, this.grid);

            this.status.on( 'error', this.error.gotError, this.error);
            this.status.on( 'set-dates', this.grid.setDates, this.grid);
            this.status.on( 'change-timespan', this.grid.setTimespan, this.grid);

            this.status.on( 'select-all', this.grid.selectAll, this.grid);
            this.status.on( 'select-none', this.grid.selectNone, this.grid);

            this.status.on( 'move-all-forward', this.grid.moveAllForward, this.grid);
            this.status.on( 'move-all-backward', this.grid.moveAllBackward, this.grid);
            this.status.on( 'zoom-all-in', this.grid.zoomAllIn, this.grid);
            this.status.on( 'zoom-all-out', this.grid.zoomAllOut, this.grid);

            this.hosts.on( 'show-graphes', this.grid.displayGraphes, this.grid);
        },
        toggleRuler: function( showRuler ){
            if ( showRuler) {
                this.ruler.show();
            } else {
                this.ruler.hide();
            }
        }
    });

    var StatusBar = Backbone.View.extend({
        events: {
            'click #select-all': 'selectAll',
            'click #select-none' : 'selectNone',
            'click #rrdeditor-submit' : 'submitDate',
            'click .ui-icon-home' : 'showHome',
            'click #item-pan-zoom' : 'showPanZoom',
            'click #item-timespan' : 'showTimespan',
            'click .ts-item': 'selectTimespan',
            'click .ui-icon-triangle-1-e': 'moveAllForward',
            'click .ui-icon-triangle-1-w': 'moveAllBackward',
            'click .ui-icon-zoomin': 'zoomInAll',
            'click .ui-icon-zoomout': 'zoomOutAll'
        },
        initialize: function(){
            this.setElement('#toolbar-content');
        },
        selectAll: function() {
            this.trigger( 'select-all');
            return false;
        },
        selectNone: function() {
            this.trigger( 'select-none');
            return false;
        },
        moveAllForward: function() {
            this.trigger( 'move-all-forward');
            return false;
        },
        moveAllBackward: function() {
            this.trigger( 'move-all-backward');
            return false;
        },
        zoomOutAll: function() {
            this.trigger( 'zoom-all-out');
            return false;
        },
        zoomInAll: function() {
            this.trigger( 'zoom-all-in');
            return false;
        },
        submitDate: function(){
            var start = Date.parse(this.$('.timespan-from').val());
            var end = Date.parse( this.$('.timespan-to').val());

            if (!start || !end) {  
                this.trigger('error', 'One of the dates is invalid');
            } else {
                this.trigger('set-dates', start, end);
            }
            return false;
        },
        _showItem : function( item ) {
            this.$('.toolbar-item').not(item).fadeOut();
            this.$(item).fadeIn();
        },
        showHome: function() {
            this._showItem( '.menu-options');
            return false;
        },
        showTimespan: function() {
            this._showItem( '.item-timespan');
            return false;
        },
        showPanZoom: function() { 
            this._showItem( '.item-pan-zoom');
            return false;
        },
        selectTimespan: function(ev) {
            var target = $(ev.currentTarget);
            var timespan = target.attr('title');
            this.trigger( 'change-timespan', timespan);
        }
    });

    var ErrorView = Backbone.View.extend({
        initialize: function() {
            this.setElement('#error-msg');
            this.$el.dialog({
                modal:true,
                autoOpen:false,
                resizable:false,
                draggable:false,
                title: 'An error has ocurred',
                //open: this.open.bind( this),
                buttons:{
                    Ok: this.close.bind( this)
                }
            });
        },
        close: function() {
            this.$el.dialog('close');
        },
        gotError: function( error) {
            this.$('.content').html( error);
            this.$el.dialog('open');
        }
    });

    var OutputDialog = Backbone.View.extend({
        initialize: function() {
            this.setElement('#output-dialog');
            this.$el.dialog( {
                title : 'Select output format:',
                modal : true,
                autoOpen: false
            });
        },
        launch: function(url) {
            var linker = url.indexOf('?') !== -1 ? '&' : '?';
            this.$('.output-link').each( function( i, e){
                var $e = $(e);
                var newUrl = url + linker + 'format=' + $e.attr('title');
                $e.attr('href', newUrl);
            });
            this.$el.dialog('open');
        }
    });
    var ExportDialog = Backbone.View.extend({
        initialize: function() {
            this.setElement('#exports-dialog');
            this.$el.dialog({
                title : 'Exportable urls of the graphes',
                modal : true,
                autoOpen: false
            }).parent().css('z-index', '50');
        },
        template: Mustache.compile(
            '<pre>{{#urls}}' +
            '{{.}}\n'+
            '{{/urls}}</pre>' + 
            '<div>{{#urls}}' +
            '<input type="text" value="{{.}}" /><br />' +
            '{{/urls}}</div>'
        ),
        launch: function(urls) {
            this.$('.content').empty().append( this.template({ urls: urls }));
            this.$el.dialog('open');
        }
    });

    var GridView = Backbone.View.extend({
        initialize: function() {
            this.setElement( '#graph-container');
            this.selected = [];
            this.outputDialog = new OutputDialog();
            this.exportDialog = new ExportDialog();
        },
        output: function( view ) {
            this.outputDialog.launch( view.getImgSrc());
        },
        exportLink: function( view) {
            var views = this._getSelected( view);
            Backbone.ajax({
                url : '/sign/',
                data: _.map( views, function( view) {
                    return { name: 'url', value: view.src };
                })
            }).done( function(signatures) {
                this.exportDialog.launch(signatures);
            }.bind(this));
        },
        setView: function( view ) {
            if ( view === 'grid') {
                this.$el.addClass('view-grid');
            } else {
                this.$el.removeClass('view-grid');
            }
        },
        template : Mustache.compile(
            '<li class="ui-widget graph-image">' +
            '<ul class="sortable ui-sortable" >' +
            '</ul>' +
            '</li>'
        ),
        setDates: function( start, end) {
            _.each( this.views, function( view){
                view.setDates( start, end);
            });
        },
        setTimespan: function( timespan) {
            var end = new Date();
            var start = addTime( end, -1, timespan);

            _.each( this.views, function( view){
                view.setDates( start, end);
            });
        },
        _getSelected: function( view ) {
            if ( this.selected.length ) {
                return this.selected;
            } else if ( view ) {
                return [ view ];
            } else {
                return this.views;
            }
        },
        moveAllForward: function() {
            _.map( this._getSelected(), function(x) {
                x.moveForward();
            });
        },
        moveAllBackward: function() {
            _.map( this._getSelected(), function(x) {
                x.moveBackward();
            });
        },
        zoomAllIn: function() {
            _.map( this._getSelected(), function(x) {
                x.zoomIn();
            });
        },
        zoomAllOut: function() {
            _.map( this._getSelected(), function(x) {
                x.zoomOut();
            });
        },
        selectAll: function( ){
            this.selected = _.map( this.views, function( v) {
                v.setSelected( true);
                return v;
            });
        },
        selectNone: function() {
            _.map( this.views, function( v) {
                v.setSelected( false);
            });
            this.selected = [];
        },
        select: function( view) {
            var isSelected = _.contains( this.selected, view);
            view.setSelected( !isSelected);
            if ( isSelected ) {
                this.selected = _.without( this.selected, view);
            } else {
                this.selected.push(view);
            }
        },
        displayGraphes: function( graphes) {
            var end = new Date();
            var start = addTime( end, -1, 'day');

            var container = $('<ul>');
            this.views = _.map( graphes, function( url ) {
                var view = new GraphView({
                    lazy: this._lazyIsSet,
                    url : url,
                    start: start,
                    end: end
                });
                view.on( 'select', this.select, this);
                view.on( 'export', this.output, this);
                view.on( 'export-link', this.exportLink, this);
                container.append(view.render().el);
                return view;
            }, this);
            this.$el.empty().append( container);
        },
        setLazy: function( isSet ) {
            if ( isSet === this._lazyIsSet) {
                return ;
            }
            this._lazyIsSet = isSet;
            if ( isSet) {
                $(window).on( 'scroll', this._lazyCheck.bind(this));
            } else {
                $(window).off( 'scroll', this._lazyCheck );
            }
        },
        _lazyCheck: function(){
            var windowTop = $(window).height() + $(window).scrollTop();
            _.chain( this.view).filter(function(x) {
                return x.lazy;
            }).each( function(x) {
                x.checkLazy(windowTop);
            });
        }
    });


    $(document).ready(function() {
        var main = new MainView();
        $.ajaxSetup({ cache: true });
    });
})( this);