/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var spawn = require('child_process').spawn;
    var fs =  require('fs');
    var colors = require('./colours.js');

    var piCommand = __dirname+'/neopix';

    if (!fs.existsSync("/dev/ttyAMA0")) { // unlikely if not on a Pi
        //RED.log.info(RED._("rpi-gpio.errors.ignorenode"));
        throw "Info : "+RED._("rpi-gpio.errors.ignorenode");
    }

    if (!fs.existsSync('/usr/local/lib/python2.7/dist-packages/neopixel.py')) {
        RED.log.warn("Can't find neopixel.py python library");
        throw "Warning : Can't find neopixel.py python library";
    }

    if ( !(1 & parseInt ((fs.statSync(piCommand).mode & parseInt ("777", 8)).toString (8)[0]) )) {
        RED.log.error(piCommand + " command is not executable");
        throw "Error : "+RED._("rpi-gpio.errors.mustbeexecutable");
    }

    // the magic to make python print stuff immediately
    process.env.PYTHONUNBUFFERED = 1;

    function piNeopixelNode(n) {
        RED.nodes.createNode(this,n);
        this.pixels = n.pixels || 1;
        this.bgnd = n.bgnd || "0,0,0";
        this.fgnd = n.fgnd || "128,128,128";
        this.mode = n.mode || "pcent";
        this.wipe = Number(n.wipe || 40);
        if (this.wipe < 0) { this.wipe = 0; }
        var node = this;
        var needle = "255,255,255";
        var p1 = /^\#[A-Fa-f0-9]{6}$/
        var p2 = /^[0-9]+,[0-9]+,[0-9]+$/
        var p3 = /^[0-9]+,[0-9]+,[0-9]+,[0-9]+$/
        var p4 = /^[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+$/

        function inputlistener(msg) {
            if (msg.hasOwnProperty("payload")) {
                var pay = msg.payload.toString().toUpperCase();
                var parts = pay.split(",");
                if (parts.length <= 2) {
                    if (parts.length === 2) { // it's a colour and length
                        if (isNaN(parseInt(parts[1]))) { parts = parts.reverse(); }
                        if (colors.getRGB(parts[0])) {
                            var l = parts[1];
                            if (node.mode.indexOf("pcent") >= 0) { l = parseInt(l / 100 * node.pixels + 0.5); }
                            l = l - 1;
                            if (node.mode.indexOf("need") >= 0) {
                                needle = colors.getRGB(parts[0]);
                                pay = "0,"+(l-1)+","+node.fgnd+"\n"+l+","+needle+"\n"+(l+1)+","+(node.pixels-1)+","+node.bgnd;
                            } else {
                                node.fgnd = colors.getRGB(parts[0]);
                                pay = "0,"+l+","+node.fgnd+"\n"+(l+1)+","+(node.pixels-1)+","+node.bgnd;
                            }
                            console.log(pay);
                        }
                        else { node.warn("Invalid payload : "+pay); return; }
                    }
                    else {
                        if (isNaN(pay)) { // it's a single colour word so set background
                            if (colors.getRGB(pay)) {
                                node.bgnd = colors.getRGB(pay);
                                pay = node.bgnd;
                            }
                            else { node.warn("Invalid payload : "+pay); return; }
                        }
                        else { // it's a single number so just draw bar
                            var l = pay;
                            if (node.mode.indexOf("pcent") >= 0) { l = parseInt(l / 100 * node.pixels + 0.5); }
                            l = l - 1;
                            if (node.mode.indexOf("need") >= 0) {
                                pay = "0,"+(l-1)+","+node.fgnd+"\n"+l+","+needle+"\n"+(l+1)+","+(node.pixels-1)+","+node.bgnd;
                            } else {
                                pay = "0,"+l+","+node.fgnd+"\n"+(l+1)+","+(node.pixels-1)+","+node.bgnd;
                            }
                        }
                    }
                }
                if ((parts.length <= 2) || p2.test(pay) || p3.test(pay) || p4.test(pay) ) {
                    if (parts.length === 3) { node.bgnd = pay; }
                    node.child.stdin.write(pay+"\n"); // handle 3 parts, 4 part and 5 parts in the python
                }
                else { node.warn("Invalid payload : "+pay); }
            }
        }

        node.child = spawn(piCommand, [node.pixels, node.wipe, node.mode]);
        node.status({fill:"green",shape:"dot",text:"ok"});

        node.on("input", inputlistener);

        node.child.stdout.on('data', function (data) {
            if (RED.settings.verbose) { node.log("out: "+data+" :"); }
        });

        node.child.stderr.on('data', function (data) {
            if (RED.settings.verbose) { node.log("err: "+data+" :"); }
        });

        node.child.on('close', function (code) {
            node.child = null;
            if (RED.settings.verbose) { node.log(RED._("rpi-gpio.status.closed")); }
            if (node.done) {
                node.status({fill:"grey",shape:"ring",text:"closed"});
                node.done();
            }
            else { node.status({fill:"red",shape:"ring",text:"stopped"}); }
        });

        node.child.on('error', function (err) {
            if (err.errno === "ENOENT") { node.error(RED._("rpi-gpio.errors.commandnotfound")); }
            else if (err.errno === "EACCES") { node.error(RED._("rpi-gpio.errors.commandnotexecutable")); }
            else { node.error(RED._("rpi-gpio.errors.error")+': ' + err.errno); }
        });

        node.on("close", function(done) {
            node.status({fill:"grey",shape:"ring",text:"closed"});
            if (node.child != null) {
                node.done = done;
                node.child.kill('SIGKILL');
            }
            else { done(); }
        });

        if (node.bgnd) {
            if (node.bgnd.split(',').length === 1) {
                node.bgnd = colors.getRGB(node.bgnd);
            }
            if (node.mode.indexOf("shift") === -1) {
                node.child.stdin.write(node.bgnd+"\n");
            }
        }

        if (node.fgnd) {
            if (node.fgnd.split(',').length === 1) {
                node.fgnd = colors.getRGB(node.fgnd);
            }
        }
    }
    RED.nodes.registerType("rpi-neopixels",piNeopixelNode);
}
