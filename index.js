var net = require('net');
const fs = require('fs');
var Service, Characteristic,UUIDGen;
var host = '192.168.1.117';
var port = 2300;
var cnt = 1;
var client = new net.Socket();
var configobj = JSON.parse(fs.readFileSync("/root/.homebridge/config.json"));
// SelfConsoleLog(JSON.stringify(configobj));

var servicecenter = {};
if (('host' in configobj["accessories"][0]) && ('port' in configobj["accessories"][0])) {
    SelfConsoleLog("Read From config.json==========");
    SelfConsoleLog('host :' + configobj["accessories"][0]['host']);
    SelfConsoleLog('port :' + configobj["accessories"][0]['port']);
    host = configobj["accessories"][0]['host'] || host;
    port = configobj["accessories"][0]['port'] || port;
}

//--------------------------------------------------------------------------------------------
var errRegexpfirst = new RegExp('^[^(@1\\*)][^;]*;','i');
var errRegexpsecond = new RegExp('^@1\\*Z[^;]*;','i');
var errRegexpthird  = new RegExp('^(@1\\*[^APSCT])[^;]*;','i');

var regpatwithA = new RegExp('^@1\\*A[^;]*;','i');

var regpatwithA_more = new RegExp('^@1\\*A[^;]*;[^;]*;','i');
var regpatwithAZ = new RegExp('^@1\\*A[^;]*;(@1){0,1}\\*Z[^;]*;','i');

//处理以@1*T 或@1*P 或@1*S 或@1*C 开头并以;结尾的报文内容
var regpatOthers = new RegExp('^@1\\*[TPSC],[^@;]*;');

//--------------------------------------------------------------------------------------------

function SelfConsoleLog(msg)
{
    console.log(msg);
}

var cmddata ='';

function process(data)
{
    var result = null;
    cmddata +=data;
    while(true)
    {
        SelfConsoleLog('cmddata is:' + cmddata);
        var errcmdfirst = errRegexpfirst.exec(cmddata);
        var errcmdsecond = errRegexpsecond.exec(cmddata);
        var errcmdthird = errRegexpthird.exec(cmddata);
        if(null != errcmdfirst)
        {
            SelfConsoleLog("Discard wrong cmd : " + errcmdfirst[0]+" (Reason: 命令格式不正确)");
            cmddata = cmddata.substring(errcmdfirst[0].length);
            if(cmddata.length !=0)
            {
                continue;
            }
        }
        if(null != errcmdsecond)
        {
            SelfConsoleLog("Discard wrong cmd : " + errcmdsecond[0]+" (Reason: 命令格式不正确)");
            cmddata = cmddata.substring(errcmdsecond[0].length);
            if(cmddata.length !=0)
            {
                continue;
            }
        }
        if(null != errcmdthird)
        {
            SelfConsoleLog("Discard wrong cmd : " + errcmdthird[0]+" (Reason: 命令格式不正确 或 @1*V;心跳命令无需处理)");
            cmddata = cmddata.substring(errcmdthird[0].length);
            if(cmddata.length !=0)
            {
                continue;
            }
        }

        var cmdwithA = regpatwithA.exec(cmddata);
        var cmdwithA_more = regpatwithA_more.exec(cmddata);
        var cmdwithAZ = regpatwithAZ.exec(cmddata);

        if(null != cmdwithA)
        {
            if(cmdwithA[0].split(',').length !=4)
            {
                SelfConsoleLog("Discard wrong cmd : " + cmdwithA[0]+" (Reason: 命令格式不正确)");
                cmddata = cmddata.substring(cmdwithA[0].length);
                if(cmddata.length !=0)
                {
                    continue;
                }
            }
            else
            {
                if(null != cmdwithA_more)
                {
                    if(null != cmdwithAZ)
                    {
                        //--------------------------------------------------------------------------------------
                        var arrfirst = cmdwithAZ[0].split(',');
                        if(arrfirst.length != 5)
                        {
                            SelfConsoleLog("Discard wrong cmd :"+cmdwithAZ[0]+" (Reason: 命令格式不正确)");
                            cmddata = cmddata.substring(cmdwithAZ[0].length);
                            if(cmddata.length !=0)
                            {
                                continue;
                            }
                        }
                
                        //验证组号和通道号的字符个数以及 范围合法性 以及保留为的合法性
                        var recvreserv = parseInt(arrfirst[1],16);
                        var recvgroupId = parseInt(arrfirst[2],16);
                        var recvchanId = parseInt(arrfirst[3],16);
                        if(isNaN(recvreserv) || isNaN(recvgroupId) || isNaN(recvchanId) ||(recvreserv !=0)||(recvgroupId <0 || recvgroupId > 15)||(recvchanId <0 || recvchanId > 255))
                        {
                            SelfConsoleLog("Discard wrong cmd :"+cmdwithAZ[0]+" (Reason: 保留为|组号|通道号 存在错误)");
                            //从cmddata中去除错误数据
                            cmddata = cmddata.substring(cmdwithAZ[0].length);
                            if(cmddata.length !=0)
                            {
                                continue;
                            }
                        }
                
                        //*Z,后面的数值应该是0xx,其中xx为两个十六进制的数
                        var zValueReg = new RegExp('0[0-9a-fA-F]{2}','ig');
                        var zValue = zValueReg.exec(cmdwithAZ[0].split('*Z,')[1]);
                        if(null == zValue)
                        {
                            SelfConsoleLog("Discard wrong cmd :"+cmdwithAZ[0]+" (Reason: 调光值不正确)");
                            //从cmddata中去除错误数据
                            cmddata = cmddata.substring(cmdwithAZ[0].length);
                            if(cmddata.length !=0)
                            {
                                continue;
                            }
                        }
                        zValue = parseInt(zValue,16);
                        zValue = parseInt(100*zValue/255,10); //去除小数点
                
                        //用获取到的组号和通道号以及zValue值更新对应的亮度值,需要转换为100份儿显示
                        if((typeof(servicecenter[recvgroupId]) !='undefined') && (typeof(servicecenter[recvgroupId][recvchanId]) != 'undefined'))
                        {
                            cmddata = cmddata.substring(cmdwithAZ[0].length);
                            
                            if((typeof(servicecenter[recvgroupId][recvchanId]['channeltype']) !='undefined') && (servicecenter[recvgroupId][recvchanId]['channeltype']=='bulb'))
                            {
                                SelfConsoleLog("servicecenter["+recvgroupId+"]["+recvchanId+"]["+"channeltype"+"].brightness = "+zValue);
                                servicecenter[recvgroupId][recvchanId].currentValue = parseInt(zValue,10);
                                servicecenter[recvgroupId][recvchanId].brightnessService.getCharacteristic(Characteristic.Brightness).updateValue(zValue);
                                if (zValue > 0) 
                                {
                                    servicecenter[recvgroupId][recvchanId].brightnessService.getCharacteristic(Characteristic.On).updateValue(true);
                                    servicecenter[recvgroupId][recvchanId].currentState = true;
                                }
                                else
                                {
                                    servicecenter[recvgroupId][recvchanId].brightnessService.getCharacteristic(Characteristic.On).updateValue(false);
                                    servicecenter[recvgroupId][recvchanId].currentState = false;
                                }
                            }
                            else
                            {
                                //SelfConsoleLog("servicecenter["+recvgroupId+"]["+recvchanId+"]["+"channeltype"+"]== 'undefined'"+"or channeltype is not bulb");
                            }
                        }
                        else
                        {
                            SelfConsoleLog("Discard wrong cmd :"+cmdwithAZ[0]+" (Reason: ServiceCenter信息中找不到对应的组号和通道号)");
                            //从cmddata中去除错误数据
                            cmddata = cmddata.substring(cmdwithAZ[0].length);
                            if(cmddata.length !=0)
                            {
                                continue;
                            }
                        }
                        //--------------------------------------------------------------------------------------
                    }
                    else
                    {
                        SelfConsoleLog("Discard wrong cmd : " + cmdwithA[0] + "Reason: 调光命令后面尾随的应是*Z 或者 @1*Z ");
                        cmddata = cmddata.substring(cmdwithA[0].length);
                        if(cmddata.length !=0)
                        {
                            continue;
                        }
                    }
                }
            }
        }

        var cmdwithOthers = regpatOthers.exec(cmddata);
        if(null != cmdwithOthers)
        {
            var arrothers = cmdwithOthers[0].split(',');
            if(arrothers.length != 4)
            {
                SelfConsoleLog("Discard wrong cmd : " + cmdwithOthers[0]+" (Reason: 命令格式不正确)");
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(cmdwithOthers[0].length);
                if(cmddata.length !=0)
                {
                    continue;
                }
            }
    
            //验证组号和通道号的字符个数以及 范围合法性 以及保留为的合法性
            
            var recvreservother = parseInt(arrothers[1],16);
            
            var recvgroupIdother = parseInt(arrothers[2],16);
            
            var recvchanIdother = parseInt(arrothers[3],16);
            if(isNaN(recvreservother) || isNaN(recvgroupIdother) || isNaN(recvchanIdother) ||(recvreservother !=0)||(recvgroupIdother <0 || recvgroupIdother > 15)||(recvchanIdother <0 || recvchanIdother > 255))
            {
                SelfConsoleLog("Discard wrong cmd : " + cmdwithOthers[0]+" (Reason: 保留为|组号|通道号 不正确)");
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(cmdwithOthers[0].length);
                if(cmddata.length !=0)
                {
                    continue;
                }
            }
            var cmdPrefix = cmdwithOthers[0].split(',')[0];
            var switchstatus = 'none';
            
            if(cmdPrefix == '@1*C')
            {
                switchstatus = false;
            }
            if(cmdPrefix == '@1*S')
            {
                switchstatus = true;
            }
            if(switchstatus !='none')
            {
                //SelfConsoleLog("Enter cmd Prefix condition......");
                //根据组号和通道号从ServiceCenter中首先找是否存在这样的一个通道号和组号,如果存在则判断是否位开关类型或者输入控制类型,是则更改状态,否则直接丢弃数据包
                if((typeof(servicecenter[recvgroupIdother]) !='undefined') && (typeof(servicecenter[recvgroupIdother][recvchanIdother]) != 'undefined'))
                {
                    cmddata = cmddata.substring(cmdwithOthers[0].length);
                    if((typeof(servicecenter[recvgroupIdother][recvchanIdother]['channeltype']) !='undefined') && (servicecenter[recvgroupIdother][recvchanIdother]['channeltype']=='switch' || servicecenter[recvgroupIdother][recvchanIdother]['channeltype']=='inputcontrol'))
                    {
                        servicecenter[recvgroupIdother][recvchanIdother].switchService.getCharacteristic(Characteristic.On).updateValue(switchstatus);
                    }
                    else
                    {
                        //SelfConsoleLog("servicecenter["+recvgroupIdother+"]["+recvchanIdother+"] == 'undefined'"+"or channeltype is not switch or inputcontrol");
                    }
                    if(cmddata.length !=0)
                    {
                        continue;
                    }
                }
                else
                {
                    
                    //SelfConsoleLog("servicecenter["+recvgroupIdother+"]["+recvchanIdother+"] == 'undefined'");
                    SelfConsoleLog("Discard wrong cmd : " + cmdwithOthers[0]+" (Reason: 组号|通道号 不正确)");
                    //从cmddata中去除错误数据
                    cmddata = cmddata.substring(cmdwithOthers[0].length);
                    if(cmddata.length !=0)
                    {
                        continue;
                    }
                }
            }
            else
            {
                SelfConsoleLog("Discard wrong cmd : " + cmdwithOthers[0]+" (Reason: 非C或S指令,可直接跳过)");
                //从cmddata中去除不需处理的指令
                cmddata = cmddata.substring(cmdwithOthers[0].length);
                if(cmddata.length !=0)
                {
                    continue;
                }
            }
        }
        SelfConsoleLog("After break cmddata :"+cmddata);
        break;
    }
}
//--------------------------------------------------------------------------------------------
client.connect(port, host, function () {
    SelfConsoleLog('CONNECTED TO: ' + host + ':' + port);
    // 建立连接后立即向服务器发送数据，服务器将收到这些数据
    cmddata='';
    setInterval(function(){
        //每20秒向服务器发送心跳包
        var cmdheart = '*U;';
        //SelfConsoleLog("send heartbeat packet :" + cmdheart);
        client.write(cmdheart);
    }, 20000);
});

// 为客户端添加“data”事件处理函数
// data是服务器发回的数据
client.on('data', function (data) {

    //SelfConsoleLog("_____________________________________________________________")
    // SelfConsoleLog('Time: ' + new Date());
    process(data);
    // var waitUntil = new Date(new Date().getTime() + 20 * 1000);
    // while(waitUntil > new Date()){}
});

// 为客户端添加“close”事件处理函数
client.on('close', function () {
    SelfConsoleLog('Connection closed');
    cmddata='';
    setTimeout(function(){
       client.connect(port, host);
   },100);
});
client.on('error',function(){
    SelfConsoleLog("                                                            ");
    SelfConsoleLog("| ---------------------------------------------------------|");
    SelfConsoleLog("| The host is Unreachable, Reconnect after 5 seconds...... |");
    SelfConsoleLog("| ---------------------------------------------------------|");
    SelfConsoleLog("                                                            ");
    SelfConsoleLog("servicecenter Content:");
    cmddata='';
    setTimeout(function(){
        client.connect(port, host);
    },100);
    
});
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.UUIDGen;
    SelfConsoleLog("============================================");


    // SelfConsoleLog("Config Context : " + JSON.stringify(configobj['accessories']));
    SelfConsoleLog("++++++++++++++++++++++++++++++++++++++++++++");
    SelfConsoleLog("=============Total Accessory : "+configobj['accessories'].length+"================");

    for (var i = 0; i < configobj['accessories'].length; i++) {
        if ((configobj['accessories'][i]['name'].split('-')[2] == 'switch') || (configobj['accessories'][i]['name'].split('-')[2] =='inputcontrol')) {
            homebridge.registerAccessory("homebridge-switchcontroller", configobj['accessories'][i]['accessory'], HomebridgeSwitchController);
        }

        if (configobj['accessories'][i]['name'].split('-')[2] == 'bulb') {
            homebridge.registerAccessory("homebridge-switchcontroller", configobj['accessories'][i]['accessory'], HomebridgeBrightnessController);
        }
    }
}


function HomebridgeSwitchController(log, config) {
    this.currentState = false;
    this.log = log;

    this.accessoryname = config["accessory"];
    
    SelfConsoleLog("this.accessoryname :" + this.accessoryname);
    SelfConsoleLog("accessory :" + config["accessory"]);
    SelfConsoleLog("name :" + config["name"]);
    this.name = config["name"];
    this.groupId = config["groupId"];
    this.channelId = config["channelId"];
    this.channeltype = config["channeltype"];
}

HomebridgeSwitchController.prototype = {

    getSwitchState: function (next) {
        //SelfConsoleLog("next is " + next);
        SelfConsoleLog("getSwitchState====currentState:" + this.currentState);
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        var cmd = "*P,0," +  GROUP.toString(16) + "," + CHANID.toString(16) + ";";
        client.write(cmd,function(err){
                if(err)
                {
                    SelfConsoleLog("Error info :"+err);
                }
                else
                {
                    SelfConsoleLog("                                                            ");
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("| TX DATA : "+ cmd);
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("                                                            ");
                    
                }
            });
        return next(null, this.currentState);
        
    },
    setSwitchState: function (powerOn, next) {
        //SelfConsoleLog("next is " + next);
        SelfConsoleLog("setSwitchState=====powerOn : " + powerOn);
        
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        
        var me = this;
        if (powerOn) {
            var cmd = "*S,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";";
            client.write(cmd,function(err){
                if(err)
                {
                    SelfConsoleLog("Error info :"+err);
                }
                else
                {
                    SelfConsoleLog("                                                            ");
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("| TX DATA : "+ cmd);
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("                                                            ");
                    me.currentState = !me.currentState;
                    
                }
            });
        }
        else {
            var cmd = "*C,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";";
            // SelfConsoleLog("cmd : " + cmd);
            
            client.write(cmd,function(err){
                if(err)
                {
                    SelfConsoleLog("Error info :"+err);
                }
                else
                {
                    SelfConsoleLog("                                                            ");
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("| TX DATA : "+ cmd);
                    SelfConsoleLog("| ---------------------------------------------------------|");
                    SelfConsoleLog("                                                            ");
                    me.currentState = !me.currentState;
                    
                }
            });
        }
        return next();        
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

        //判断组号为键的对象是否还不存在,不存在则先创建
        //判断通道号为键的对象是否还不存在,不存在则先创建
        if(typeof(servicecenter[me.groupId]) == 'undefined')
        {
            servicecenter[me.groupId]={};
        }
        if(typeof(servicecenter[me.groupId][me.channelId]) == 'undefined')
        {
            servicecenter[me.groupId][me.channelId]=me;
        }

        return [informationService, switchService];
    }
}

//--------------------------------------------------------------------------------------------------------------

function HomebridgeBrightnessController(log, config) {
    this.currentValue = 0;
    this.beforeTurnOffValue = 0;
    this.currentState = false;
    this.log = log;

    this.accessoryname = config["accessory"];
    
    SelfConsoleLog("this.accessoryname :" + this.accessoryname);
    SelfConsoleLog("accessory :" + config["accessory"]);
    SelfConsoleLog("name :" + config["name"]);
    this.name = config["name"];
    this.groupId = config["groupId"];
    this.channelId = config["channelId"];
    this.channeltype = config["channeltype"];
    this.initialized = false;
}

HomebridgeBrightnessController.prototype = {

    getBulbState: function (next) {
        // SelfConsoleLog("getBulbState====currentState:" + this.currentState);
        // SelfConsoleLog(next);
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        var cmd = "*P,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";";
            // SelfConsoleLog("cmd : " + cmd);
            
        client.write(cmd,function(err){
            if(err)
            {
                SelfConsoleLog("Error info :"+err);
            }
            else
            {
                // SelfConsoleLog("                                                            ");
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("| TX DATA : "+ cmd);
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("                                                            ");
                
            }
        });
        return next(null, this.currentState);
        
    },
    setBulbState: function (powerOn, next) {
        //SelfConsoleLog("setBulbState  : " + powerOn);
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        //SelfConsoleLog("Operation On " + GROUP + "-" + CHANID);
        var me = this;
        if (powerOn) {

        }
        else {
            SelfConsoleLog("Before setBulbState off me.currentValue = "+me.currentValue);
            me.beforeTurnOffValue = me.currentValue;
            var cmd = "*C,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";";
            // SelfConsoleLog("                                                            ");
            // SelfConsoleLog("| ---------------------------------------------------------|");
            // SelfConsoleLog("| TX DATA : "+ cmd);
            // SelfConsoleLog("| ---------------------------------------------------------|");
            // SelfConsoleLog("                                                            ");
            client.write(cmd);
        }
        me.currentState = !me.currentState;
        return next();
    },
    getBrightnessValue: function (next) {
        // SelfConsoleLog("getBrightnessValue====currentValue:" + this.currentValue);
        // SelfConsoleLog(next);
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        var cmd = "*P,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";";
        client.write(cmd,function(err){
            if(err)
            {
                SelfConsoleLog("Error info :"+err);
            }
            else
            {
                // SelfConsoleLog("                                                            ");
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("| TX DATA : "+ cmd);
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("                                                            ");
                
            }
        });
        return next(null, this.currentValue);
    },
    setBrightnessValue: function (brightnessValue, next) {
        
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        // if (CHANID.length == 1) {
        //     CHANID = "0" + CHANID;
        // }
        
        var me = this;

        // SelfConsoleLog("me.currentState : "+me.currentState);
        if((me.currentState == false) &&(brightnessValue !=0))
        {
            SelfConsoleLog("In setBrightnessValue Condition  me.beforeTurnOffValue = "+me.beforeTurnOffValue);
            
            if((me.beforeTurnOffValue == 0))
            {
                brightnessValue = 100;
            }
            else
            {
                brightnessValue = me.beforeTurnOffValue;
            }
        }

        SelfConsoleLog("setBrightnessValue  : " + brightnessValue);

        var cmd = "*A,0," + GROUP.toString(16) + "," + CHANID.toString(16) + ";*Z,0" + parseInt(brightnessValue*255/100).toString(16) + ";";

        client.write(cmd,function(err)
        {
            if(err)
            {
                SelfConsoleLog("Error info :"+err);
            }
            else
            {
                // SelfConsoleLog("                                                            ");
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("| TX DATA : "+ cmd);
                // SelfConsoleLog("| ---------------------------------------------------------|");
                // SelfConsoleLog("                                                            ");
                me.currentValue = brightnessValue;
                me.beforeTurnOffValue = brightnessValue;
                // SelfConsoleLog("In setBrightnessValue me.currentValue = "+me.currentValue);
            }
        });
        
        //SelfConsoleLog(next.toString());
  
        
        

        setTimeout(function(){
                me.brightnessService.getCharacteristic(Characteristic.Brightness).updateValue(me.currentValue);
        },30);

        return next();
    },
    getServices: function () {
        var me = this;

        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "LingKeMi Manufacturer")
            .setCharacteristic(Characteristic.Model, "LingKeMi Model")
            .setCharacteristic(Characteristic.SerialNumber, "LingKeMi SerialNumber");


        var brightnessService = new Service.Lightbulb(me.name);
         brightnessService.getCharacteristic(Characteristic.On)
            .on('get', this.getBulbState.bind(this))
            .on('set', this.setBulbState.bind(this));
        brightnessService.getCharacteristic(Characteristic.Brightness)
            .on('get', this.getBrightnessValue.bind(this))
            .on('set', this.setBrightnessValue.bind(this));
       
        this.informationService = informationService;
        this.brightnessService = brightnessService;

        //判断组号为键的对象是否还不存在,不存在则先创建
        //判断通道号为键的对象是否还不存在,不存在则先创建
        if(typeof(servicecenter[me.groupId]) == 'undefined')
        {
            servicecenter[me.groupId]={};
        }
        if(typeof(servicecenter[me.groupId][me.channelId]) == 'undefined')
        {
            servicecenter[me.groupId][me.channelId]=me;
        }

        return [informationService,brightnessService];
    }
}
