#!/usr/bin/python
#
# Copyright 2016 IBM Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Import library functions we need
import sys
import os
import unicornhat as UH

if sys.version_info >= (3,0):
    print("Sorry - currently only configured to work with python 2.x")
    sys.exit(1)

brightness = float(sys.argv[1])/100
UH.off()
UH.brightness(brightness)

while True:
    try:
        data = raw_input()
        if len(data) < 20:
            if data[0] == "B":
                UH.brightness(float(data[1:])/100)
            if data[0] == "R":
                UH.rotation(float(data[1:]))
        else:
            q = 0
            for p in range(64):
                UH.set_pixel(p%8,int(p/8),ord(data[q]),ord(data[q+1]),ord(data[q+2]))
                q+=3
            UH.show()
    except (EOFError, SystemExit):  # hopefully always caused by us sigint'ing the program
        sys.exit(0)
    except Exception as ex:
        print "bad data: "+data
