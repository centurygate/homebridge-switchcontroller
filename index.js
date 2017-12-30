var net = require('net');
const fs = require('fs');
var Service, Characteristic,UUIDGen;
var HOST = '192.168.1.117';
var PORT = 2300;
var GROUP = 1;
var client = new net.Socket();
var configobj = JSON.parse(fs.readFileSync("/home/free/.homebridge/config.json"));
console.log(JSON.stringify(configobj));
var mapobj = {};
if (('HOST' in configobj["accessories"][0]) && ('PORT' in configobj["accessories"][0]) && ('GROUP' in configobj["accessories"][0])) {
    console.log("Read From config.json==========");
    console.log('HOST :' + configobj["accessories"][0]['HOST']);
    console.log('PORT :' + configobj["accessories"][0]['PORT']);
    console.log('PORT :' + configobj["accessories"][0]['GROUP']);
    HOST = configobj["accessories"][0]['HOST'] || HOST;
    PORT = configobj["accessories"][0]['PORT'] || PORT;
    GROUP = configobj["accessories"][0]['GROUP'] || GROUP;
}
client.connect(PORT, HOST, function () {
    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
    // 建立连接后立即向服务器发送数据，服务器将收到这些数据
});

// 为客户端添加“data”事件处理函数
// data是服务器发回的数据
client.on('data', function (data) {

    // console.log('DATA: ' + data);
    console.log("                                                            ");
    console.log("| ---------------------------------------------------------|");
    console.log("| RX DATA : "+ cmd);
    console.log("| ---------------------------------------------------------|");
    console.log("                                                            ");
    // 完全关闭连接
    //client.destroy();
});

// 为客户端添加“close”事件处理函数
client.on('close', function () {
    console.log('Connection closed');
});
client.on('error',function(){
    console.log("                                                            ");
    console.log("| ---------------------------------------------------------|");
    console.log("| The host is Unreachable, Reconnect after 5 seconds...... |");
    console.log("| ---------------------------------------------------------|");
    console.log("                                                            ");
    
    // setTimeout(function(){
    //     client.connect(PORT, HOST, function() {

    //         console.log('CONNECTED TO: ' + HOST + ':' + PORT);
    //         // 建立连接后立即向服务器发送数据，服务器将收到这些数据 
    //         client.write('I am Chuck Norris!');
        
    //     });
    // },5000);
    setTimeout(function(){
        client.connect(PORT, HOST);
    },5000);
    
});
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.UUIDGen;
    console.log("============================================");


    console.log("Config Context : " + JSON.stringify(configobj['accessories']));
    console.log("++++++++++++++++++++++++++++++++++++++++++++");
    for (var i = 0; i < configobj['accessories'].length; i++) {
        if (configobj['accessories'][i]['name'].split('-')[2] == 'switch') {
            homebridge.registerAccessory("homebridge-switchcontroller", configobj['accessories'][i]['accessory'], HomebridgeSwitchController);
        }

        if (configobj['accessories'][i]['name'].split('-')[2] == 'brightness') {
            homebridge.registerAccessory("homebridge-switchcontroller", configobj['accessories'][i]['accessory'], HomebridgeBrightnessController);
        }
    }
    //homebridge.registerAccessory("homebridge-switchcontroller","HomebridgeSwitchController-chan1",HomebridgeSwitchController);
    // homebridge.registerAccessory("homebridge-switchcontroller","HomebridgeSwitchController-chan2",HomebridgeSwitchController);
}


function HomebridgeSwitchController(log, config) {
    this.currentState = false;
    this.log = log;

    this.accessoryname = config["accessory"];
    mapobj[this.accessoryname] = (this.accessoryname.split("chan"))[1];
    console.log("this.accessoryname :" + this.accessoryname);
    console.log("accessory :" + config["accessory"]);
    console.log("name :" + config["name"]);
    this.name = config["name"];
}

HomebridgeSwitchController.prototype = {

    getSwitchState: function (next) {
        //console.log("next is " + next);
        console.log("getSwitchState====currentState:" + this.currentState);
        // console.log(next);
        return next(null, this.currentState);
    },
    setSwitchState: function (powerOn, next) {
        //console.log("next is " + next);
        console.log("setSwitchState=====powerOn : " + powerOn);
        var CHANID = mapobj[this.accessoryname];
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        // console.log("Operation On " + GROUP + "-" + CHANID);
        var me = this;
        if (powerOn) {
            var cmd = "*S,0," + GROUP + "," + CHANID + ";";
            // console.log("cmd : " + cmd);

            client.write(cmd,function(err){
                if(err)
                {
                    console.log("Error info :"+err);
                }
                else
                {
                    console.log("                                                            ");
                    console.log("| ---------------------------------------------------------|");
                    console.log("| TX DATA : "+ cmd);
                    console.log("| ---------------------------------------------------------|");
                    console.log("                                                            ");
                    me.currentState = !me.currentState;
                    return next();
                }
            });
        }
        else {
            var cmd = "*C,0," + GROUP + "," + CHANID + ";";
            // console.log("cmd : " + cmd);
            
            client.write(cmd,function(err){
                if(err)
                {
                    console.log("Error info :"+err);
                }
                else
                {
                    console.log("                                                            ");
                    console.log("| ---------------------------------------------------------|");
                    console.log("| TX DATA : "+ cmd);
                    console.log("| ---------------------------------------------------------|");
                    console.log("                                                            ");
                    me.currentState = !me.currentState;
                    return next();
                }
            });
        }        
    },
    getServices: function () {
        var me = this;

        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "LingKeMi Manufacturer")
            .setCharacteristic(Characteristic.Model, "LingKeMi Model")
            .setCharacteristic(Characteristic.SerialNumber, "LingKeMi SerialNumber");

        var switchService = new Service.Switch(me.name);
        switchService.getCharacteristic(Characteristic.On)
            .on('get', this.getSwitchState.bind(this))
            .on('set', this.setSwitchState.bind(this));

        this.informationService = informationService;
        this.switchService = switchService;
        return [informationService, switchService];
    }
}

//--------------------------------------------------------------------------------------------------------------

function HomebridgeBrightnessController(log, config) {
    this.currentValue = 0;
    this.currentState = false;
    this.log = log;

    this.accessoryname = config["accessory"];
    mapobj[this.accessoryname] = (this.accessoryname.split("chan"))[1];
    console.log("this.accessoryname :" + this.accessoryname);
    console.log("accessory :" + config["accessory"]);
    console.log("name :" + config["name"]);
    this.name = config["name"];
}

HomebridgeBrightnessController.prototype = {

    getBulbState: function (next) {
        console.log("getBulbState====currentState:" + this.currentState);
        // console.log(next);
        return next(null, this.currentState);
    },
    setBulbState: function (powerOn, next) {
        console.log("setBulbState=====powerOn : " + powerOn);
        var CHANID = mapobj[this.accessoryname];
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        console.log("Operation On " + GROUP + "-" + CHANID);
        var me = this;
        // if (powerOn) {
        //     var cmd = "*S,0," + GROUP + "," + CHANID + ";\n";
        //     console.log("cmd : " + cmd);
        //     client.write(cmd);
        // }
        // else {
        //     var cmd = "*C,0," + GROUP + "," + CHANID + ";\n";
        //     console.log("cmd : " + cmd);
        //     client.write(cmd);
        // }
        me.currentState = !me.currentState;
        return next();
    },
    getBrightnessValue: function (next) {
        console.log("getBrightnessValue====currentValue:" + this.currentValue);
        // console.log(next);
        return next(null, this.currentValue);
    },
    setBrightnessValue: function (brightnessValue, next) {
        console.log("setBrightnessValue=====brightnessValue : " + brightnessValue);
        var CHANID = mapobj[this.accessoryname];
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        //console.log("Operation On " + GROUP + "-" + CHANID);
        var me = this;
        var cmd = "*A,0," + GROUP + "," + CHANID + ";*Z," + parseInt(brightnessValue*255/100).toString(16) + ";";
        //console.log("cmd : " + cmd);
        // client.write(cmd);
        client.write(cmd,function(err)
        {
            if(err)
            {
                console.log("Error info :"+err);
            }
            else
            {
                console.log("                                                            ");
                console.log("| ---------------------------------------------------------|");
                console.log("| TX DATA : "+ cmd);
                console.log("| ---------------------------------------------------------|");
                console.log("                                                            ");
                me.currentValue = brightnessValue;
                return next();
            }
        });

    },
    getServices: function () {
        var me = this;

        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "LingKeMi Manufacturer")
            .setCharacteristic(Characteristic.Model, "LingKeMi Model")
            .setCharacteristic(Characteristic.SerialNumber, "LingKeMi SerialNumber");


        var brightnessService = new Service.Lightbulb(me.name);
        brightnessService.getCharacteristic(Characteristic.Brightness)
            .on('get', this.getBrightnessValue.bind(this))
            .on('set', this.setBrightnessValue.bind(this));
        brightnessService.getCharacteristic(Characteristic.On)
            .on('get', this.getBulbState.bind(this))
            .on('set', this.setBulbState.bind(this));
        this.informationService = informationService;
        this.brightnessService = brightnessService;
        return [informationService,brightnessService];
    }
}