#!/usr/bin/env python
# -*- coding: utf-8 -*-

import settings

from collectdweb.collectd_adapter import Collectd
from collectdweb.parser import Parser
from collections import defaultdict

__all__ = [ 'Graph', 'Plugin', 'Host' ]

collectd = Collectd.from_config_file( settings.COLLECTD_CONFIG_FILE)
GRAPHS = Parser().parse( open( settings.GRAPH_DEFINITIONS, 'rb'))

class DoesNotExist(Exception):
    """
    Exception raised when a model is not found
    """
    def __init__(self, model, name):
        super( DoesNotExist, self).__init__( name)
        self.model = model

    def __str__(self):
        return '%s %s does not exist' % ( self.model.__name__, super(DoesNotExist, self).__str__())

class HostManager(object):
    def __iter__(self):
        return iter( collectd.get_all_hosts())
    def all( self):
        return [ Host(name) for name in self ]
    def get(self, name):
        if name in self:
            return Host( name)
        raise Host.DoesNotExist( Host, name)

class PluginManager( object):
    def __init__(self, host):
        self.host = host
    def __iter__(self):
        all_the_plugins = collectd.get_plugins_of([ self.host.name ])
        plugins_count = defaultdict( list)
        for plugin,instance in all_the_plugins:
            plugins_count[plugin].append( instance)
        for plugin, instances in plugins_count.items():
            if len( instances) > 1:
                all_the_plugins.add( ( plugin, frozenset(instances)) )
        return iter( all_the_plugins )

    def all(self):
        return [ Plugin( self.host, name, instance ) for name, instance in self ]
    def get(self, plugin, plugin_instance=None):
        for plugin_, plugin_instance_ in self:
            if plugin == plugin_ and (
                    plugin_instance == plugin_instance_ or
                    plugin_instance == '*' and isinstance( plugin_instance_, frozenset)):
                return Plugin( self.host, plugin, plugin_instance_)
        raise Plugin.DoesNotExist( Plugin, plugin + (
                '-' + plugin_instance if plugin_instance else '' ))

class GraphManager( object):
    def __init__(self, plugin):
        self.plugin = plugin
    def __iter__(self):
        sources = collectd.get_graphes_of([ path for name, path in self.plugin.rrd_source() ])
        graphes = defaultdict(list)

        for graph, instance in sources:
            graphes[graph].append( instance)

        for graph, instances in graphes.items():
            graphdef = GRAPHS.get( graph)
            if graphdef is not None and graphdef.list_type_instances:
                for i in instances:
                    yield graph, i
            else:
                yield graph, instances

    def all(self):
        return [ Graph( self.plugin, type_, type_instance)
                for type_, type_instance in  self ]

    def get(self, type_, type_instance=None):
        if type_instance is not None:
            if (  type_, type_instance) in self:
                return Graph( self.plugin, type_, type_instance)
        else:
            for type, type_instance in self:
                if type == type_ and not isinstance(type_instance, basestring):
                    return Graph( self.plugin, type_, type_instance)
        raise Graph.DoesNotExist( Graph, type_)

class Host(object):
    """
    A model representing a host 
    
    :param name: The name of the host in the rrd file structure.

    .. attribute:: objects

        An instance of :class:`HostManager` which allows access to the :class:`Host` objects.
    """

    objects = HostManager()
    def __init__(self, name):
        self.name = name

    @property
    def full_name(self):
        return self.name

    @property
    def plugins(self):
        """
        The list of :class:`Plugin` attached to this instance
        """
        return PluginManager( self)

    class DoesNotExist( DoesNotExist):
        pass

    def get_path( self):
        return self.name

    def __hash__(self):
        return hash(self.name)
    def __eq__(self, other):
        return (self is other) or ( self.__class__ is other.__class__ and self.name == other.name )
    def __ne__(self, other):
        return not (self == other)
    def __repr__(self):
        return '<Host %s>' % self.name #pragma: no cover

class RRDObject(object):
    def __init__(self, name, instance):
        self.name = name
        self.instance = ( instance
                if instance is None or isinstance( instance, basestring)
                else frozenset( instance))

    def _is_single_file(self):
        return isinstance( self.instance, basestring)
    def _is_multiple_files(self):
        return isinstance( self.instance, frozenset)

    @property
    def full_name(self):
        return self.name + ( '-' + self.instance
                if self._is_single_file() else
                '')

    def __repr__(self):
        return '<%s %s>' % ( self.__class__.__name__, self.full_name) #pragma: nocover

class Plugin(RRDObject):
    """
    Model representing a Plugin

    :param host: The :class:`Host` to which this plugin is attached.
    :param plugin: the plugin name.
    :param plugin_instance: None, a string or a set of instance.

    """
    def __init__(self, host, plugin, plugin_instance):
        super( Plugin, self).__init__( plugin, plugin_instance)
        self.host = host

    @property
    def full_name(self):
        return super( Plugin, self).full_name + ( ''
                if not self._is_multiple_files() else
                '-*')

    @property
    def graphes(self):
        """
        The list of :class:`Graph` attached to this instance
        """
        return GraphManager( self)

    class DoesNotExist( DoesNotExist):
        pass

    def rrd_source(self):
        """
        return a list of the directories which contains the rrd files.
        """
        prefix = self.host.get_path() + '/'
        if not self._is_multiple_files():
            return [ ('', prefix + self.full_name) ]
        else:
            return [ ( instance, prefix + self.name + '-' + instance) for instance in self.instance ]

    @property
    def title(self):
        return self.host.name + '/' + self.full_name

    def __hash__(self):
        return hash( (self.name, self.instance))
    def __eq__(self, other):
        return ( self is other ) or ( self.__class__ is other.__class__ and
                self.host == other.host and 
                self.name == other.name and 
                self.instance == other.instance )
    def __ne__(self, other):
        return not (self == other)

class Graph(RRDObject):
    """
    Model representing a Graph
    
    :param plugin: The :class:`Plugin` instance to which this plugin is linked.
    :param string type: The type of graph. Determine the Graph definition.
    :param type_instance: None, a string or set of string determining related to this graph
    """
    def __init__(self, plugin, type_, type_instance):
        super( Graph, self).__init__( type_, type_instance)
        self.plugin = plugin
        self.graphdef = GRAPHS.get( self.name)

    class DoesNotExist( DoesNotExist):
        pass
    class NoDefinition( Exception):
        pass

    @property
    def title(self):
        return '{plugin.title}/{type}'.format(
                plugin=self.plugin,
                type=self.full_name,
                )

    def generate(self, start, end, **kw):
        """
        Generate the graph from *start* to *end*
        """
        if not self.graphdef:
            raise self.NoDefinition, self.name
        sources = self.rrd_source()
        upper = kw.get( 'upper')
        if upper and upper[-1] == '%':
            try:
                upper = float(upper[:-1])
            except ValueError:
                raise ValueError, 'Invalid value for upper: %s' % upper
            maximum = self.graphdef.get_max( sources, start, end)
            upperlimit = max( maximum.values()) * upper / 100
            kw['upper'] = str( upperlimit)
        return self.graphdef.build( self.title, sources, start, end, **kw)

    def calculate_max(self, start, end):
        """
        Determine the max from *start* to *end*
        """
        if not self.graphdef:
            raise self.NoGraph
        return self.graphdef.get_max( self.rrd_source(), start, end)

    def rrd_source(self):
        """
        List the files attached to this graph.

        return a list of tuples ( plugin, instance, file )
        """
        if not self._is_multiple_files():
            return [
                    ( plugin, self.full_name, collectd.get_file( prefix_plugin + '/' + self.full_name + '.rrd'))
                    for plugin, prefix_plugin in self.plugin.rrd_source()
                    ]
        else:
            return [
                    (  plugin, instance, collectd.get_file( prefix_plugin + '/' + self.name + '-' + instance + '.rrd' ))
                    for instance in self.instance
                    for plugin, prefix_plugin in self.plugin.rrd_source()
                    ]

    def __hash__(self):
        return hash(( self.name, self.plugin, self.instance))

    def __ne__(self,other):
        return not ( self == other)

    def __eq__(self, other):
        return ( self.__class__ is other.__class__ and 
                self.name == other.name and
                self.plugin == other.plugin and
                self.instance == other.instance
                )
