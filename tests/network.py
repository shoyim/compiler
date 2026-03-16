"""
Description
    Accessing external resources could be potentially dangerous

"""

import urllib.request
contents = urllib.request.urlopen("http://localhost:2000").read()