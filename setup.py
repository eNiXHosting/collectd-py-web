from setuptools import setup

setup(
        name='collectd-py-web',
        version='1.1',
        description='Light web interface for Collectd',
        author='eNix',
        author_email='gr@enix.org',
        url='http://enix.org/',
        packages=['collectdweb'],
        scripts=[ 'bin/collectdweb'],
        classifiers=[
            'Intended Audience :: System Administrators',
            'Environment :: Web Environment',
            'Framework :: bottle',
            'License :: OSI Approved :: GNU General Public License (GPL)',
            'Programming Language :: Python :: 2.7',
            'Topic :: Internet :: WWW/HTTP',
            'Topic :: Multimedia :: Graphics',
            'Topic :: Scientific/Engineering :: Information Analysis',
            'Topic :: System :: Monitoring',
            ],
        include_package_data=True,
        install_requires=[
            'bottle>=0.11',
            ]
        )
