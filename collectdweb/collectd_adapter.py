#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import itertools

def pad( lst, n):
    """
    return a tuple of *lst* and None with a length of at least *n*
    """
    lst.extend( None for x in xrange(len(lst), n))
    return tuple( lst)

class Collectd( object):
    """
    A collectd server running on this host.

    :param config_file: A collection.conf file of collectd
    """
    def __init__(self, config_file):
        self.filename = config_file

        self._config_loaded = False
        self._filesystem = None

        self._libdirs = set()
        self._datadirs = set()

    def load_config_file( self):
        """
        Load a config file and initialize libdirs and datadirs
        """
        handle = open( self.filename, 'r')
        lines = (
                map( str.strip, line.split(':', 1))
                for line in itertools.imap( str.strip, handle)
                if not line.startswith( '#') and ':' in line
                )
        lines =(
                ( key.lower(), value[1:-1])
                for key, value in lines
                if key and value[0] == '"' and value[-1] == '"'
                )
        for key, value in lines:
            if key == 'libdir':
                if os.path.isdir( value):
                    self._libdirs.add( value)
            elif key == 'datadir':
                if os.path.isdir( value):
                    self._datadirs.add( value)
        self._loaded = True

    @property
    def datadirs(self):
        """
        A list of directories containing a rrd file structure.
        """
        if not self._config_loaded:
            self.load_config_file()
        return self._datadirs
    @property
    def libdirs(self):
        if not self._config_loaded:
            self.load_config_file()
        self.load_config_file()
        return self._libdirs

    def get_inside( self, dirnames):
        for datadir in self.datadirs:
            for dirname in dirnames:
                try:
                    listing = os.listdir( os.path.join( datadir,  dirname))
                except OSError:
                    continue
                for entry in listing:
                    if entry[0] == '.':
                        continue
                    path = os.path.join( datadir, dirname, entry)
                    yield path, entry

    def get_dirs_inside( self, dirnames):
        """
        Return the directories inside each directory of *dirnames*
        inside each directory of :attr:`datadir`
        """
        for path, entry in self.get_inside( dirnames):
            if os.path.isdir( path):
                yield entry

    def get_rrd_inside( self, dirnames):
        for path, entry in self.get_inside( dirnames):
            if os.path.isfile( path) and entry.endswith( '.rrd'):
                yield entry

    def get_all_hosts(self):
        """
        Returns a set of all the hosts for which collectd is getting values
        """
        return set( name
                for name in self.get_dirs_inside(['']))

    def get_plugins_of(self, hosts ):
        """
        Return a set of the plugins contained inside a list of hosts

        The plugins are represented by a tuple (plugin, instance)
        """
        return set( pad( name.split('-',1), 2)
                for name  in self.get_dirs_inside( hosts ))

    def get_graphes_of( self, plugins ):
        """
        Return a set of the graphes contained inside a list of plugins.
        The plugins of the list contains the host.

        The graphes are represented by a tuple (graph, instance)
        """
        return set( pad(graph.rsplit('.',1)[0].split('-', 1), 2)
                for graph in self.get_rrd_inside( plugins))

    def get_file(self, relative_path):
        """
        Return an existing absolute file path of a *relative_path* relative to a datadir
        else raise :exc:`ValueError`.
        """
        for datadir in self.datadirs:
            abs_path = os.path.join( datadir, relative_path)
            if os.path.isfile( abs_path):
                return abs_path
        raise ValueError, 'Path %s does not exits' % relative_path

