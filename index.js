var net = require('net');
const fs = require('fs');
var Service, Characteristic,UUIDGen;
var host = '192.168.1.117';
var port = 2300;
var cnt = 1;
var client = new net.Socket();
var configobj = JSON.parse(fs.readFileSync("/home/free/.homebridge/config.json"));
// console.log(JSON.stringify(configobj));

var servicecenter = {};
if (('host' in configobj["accessories"][0]) && ('port' in configobj["accessories"][0])) {
    console.log("Read From config.json==========");
    console.log('host :' + configobj["accessories"][0]['host']);
    console.log('port :' + configobj["accessories"][0]['port']);
    host = configobj["accessories"][0]['host'] || host;
    port = configobj["accessories"][0]['port'] || port;
}

//--------------------------------------------------------------------------------------------
// var newregpat = new RegExp('@1(\\*[A-Z]);','ig');
// var newregpat2 = new RegExp('@1(\\*[A-Z],)+([^@;]*,)*[^@;]*;','ig');
var regpatwithAZfirst = new RegExp('@1\\*A,[^@;]*,[^@;]*,[^@;]*;\\*Z,[^@;]*;','i');
var regpatwithAZsecond = new RegExp('@1\\*A,[^@;]*,[^@;]*,[^@;]*;@1\\*Z,[^@;]*;','i');

var ignoreRegPatOne = new RegExp('@1\\*[AZPSTCV],0,[0-9a-fA-F]{1,2},[0-9a-fA-F]{1,2};','i');
var ignoreRegPatTwo = new RegExp('\\*Z,0[0-9a-fA-F]{1,2};','i');
var ignoreRegPatThree = new RegExp('@1\\*[^@;]*;');
var cmddata ='';
//处理以@1*T 或@1*P 或@1*S 或@1*C 开头并以;结尾的报文内容
var regpatOthers = new RegExp('@1\\*[TPSC],[^@;]*;');
// var regspecial = new RegExp('@1\\*Z,0[0-9a-fA-F]{2}','ig');
function process(data)
{

    var goon = true;
    var result = null;
    cmddata +=data;
    while(goon)
    {
        console.log('cmddata is:' + cmddata);
        var element = cmddata.split(';')[0];

        //说明cmddata里面没有';',说明数据包过来一点点则返回
        if(element == cmddata)
        {
            console.log("cmddata has not receive ';' token");
            console.log("Jumpout process------------");
            return;
        }
        element = element +';';
        // console.log("condition1:"+ignoreRegPatOne.exec(element));
        var condition1 = (null === ignoreRegPatOne.exec(element));
        
        // console.log("condition2:"+ignoreRegPatTwo.exec(element));
        var condition2 = (null === ignoreRegPatTwo.exec(element));
        
        // console.log("condition3:"+ignoreRegPatThree.exec(element));
        var condition3 = (null !== ignoreRegPatThree.exec(element));
        
        console.log("condition1 = "+condition1 +" condition2 = "+condition2 + " condition3 = " + condition3);
        if(condition1 && condition2 && condition3)
        {
            //可以使用： @1*A;@1*A,*Z,00y;@1*S,0,0,01; 来测试这个分支的处理
            //主要针对直接发送*A;  *P;  *Z; *S; *T; *U; 另外客户端会收到@1*A; @1*P; @1*Z; @1*S; @1*T; @1*V; 本情况下直接丢弃改内容
            //也有可能收到这样的错误数据: @1*A,*Z,00y;    或       @1*Z,00y; 或  @1*A,0,0,or,*Z,03t; 这种类似的格式也不正确,以逗号分隔后不是四个元素,
            //即便是四个元素也需要验证其中的保留位是否位0,组号和通道号转为数值后是否位Nan或者是否符合0~F 或00~FF通道范围,同时也要检查是否存在这个组号和通道号

            console.log("UnUseful Command:"+element);

            //从cmddata中去除错误数据
            cmddata = cmddata.substring(element.length);
            console.log("After Process,cmddata is : "+cmddata);
            if(cmddata.length ==0)
            {
                console.log("Return......");
                return;
            }
            goon = true;
            continue;
        }
        
        //对带@1*A模式的字符串进行处理
        result = regpatwithAZfirst.exec(cmddata) ||regpatwithAZsecond.exec(cmddata);
       
        if(result!=null) 
        {
            console.log("result[0] is : "+result[0]);
            /*********************************
             * 
             
             * *     @1*A,0,0,01;*Z,037;
             
             
             * *     @1*A,0,0,01;*Z,000;
             * 
             *********************************/
            
            var arrfirst = result[0].split(',');
            if(arrfirst.length != 5)
            {
                console.log("2 Invalid Command:"+result[0]);
    
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
    
            //验证组号和通道号的字符个数以及 范围合法性 以及保留为的合法性
            var recvreserv = parseInt(arrfirst[1],16);
            var recvgroupId = parseInt(arrfirst[2],16);
            var recvchanId = parseInt(arrfirst[3],16);
            if(isNaN(recvreserv) || isNaN(recvgroupId) || isNaN(recvchanId) ||(recvreserv !=0)||(recvgroupId <0 || recvgroupId > 15)||(recvchanId <0 || recvchanId > 255))
            {
                console.log('Reserved Number or GroupId or ChannelID Wrong!');
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
    
            //*Z,后面的数值应该是0xx,其中xx为两个十六进制的数
            var zValueReg = new RegExp('0[0-9a-fA-F]{2}','ig');
            var zValue = zValueReg.exec(result[0].split('*Z,')[1]);
            if(null == zValue)
            {
                console.log('zValue is Wrong!');
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
            zValue = parseInt(zValue,16);
            zValue = parseInt(100*zValue/255,10); //去除小数点
    
            //用获取到的组号和通道号以及zValue值更新对应的亮度值,需要转换为100份儿显示
            if((typeof(servicecenter[recvgroupId]) !='undefined') && (typeof(servicecenter[recvgroupId][recvchanId]) != 'undefined'))
            {
                cmddata = cmddata.substring(result[0].length);
                
                if((typeof(servicecenter[recvgroupId][recvchanId]['channeltype']) !='undefined') && (servicecenter[recvgroupId][recvchanId]['channeltype']=='bulb'))
                {
                    console.log("servicecenter["+recvgroupId+"]["+recvchanId+"]["+"channeltype"+"].brightness = "+zValue);
                    servicecenter[recvgroupId][recvchanId]['service'].getCharacteristic(Characteristic.Brightness).updateValue(zValue);
                    if (zValue > 0) 
                    {
                        servicecenter[recvgroupId][recvchanId]['service'].getCharacteristic(Characteristic.On).updateValue(true);
                    }
                    else
                    {
                        servicecenter[recvgroupId][recvchanId]['service'].getCharacteristic(Characteristic.On).updateValue(false);
                    }
                }
                else
                {
                    console.log("servicecenter["+recvgroupId+"]["+recvchanId+"]["+"channeltype"+"]== 'undefined'"+"or channeltype is not switch or inputcontrol");
                }
                
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
    
            }
            else
            {
                console.log("servicecenter["+recvgroupId+"]["+recvchanId+"] == 'undefined'");
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
            
        }
        
        result = regpatOthers.exec(cmddata);
        if(result !=null)
        {
            console.log("result[0] is : "+result[0]);
            
            var arrothers = result[0].split(',');
            if(arrothers.length != 4)
            {
                console.log("3 Invalid Command:"+result[0]);
    
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
    
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
    
            //验证组号和通道号的字符个数以及 范围合法性 以及保留为的合法性
            
            var recvreservother = parseInt(arrothers[1],16);
            
            var recvgroupIdother = parseInt(arrothers[2],16);
            
            var recvchanIdother = parseInt(arrothers[3],16);
            if(isNaN(recvreservother) || isNaN(recvgroupIdother) || isNaN(recvchanIdother) ||(recvreservother !=0)||(recvgroupIdother <0 || recvgroupIdother > 15)||(recvchanIdother <0 || recvchanIdother > 255))
            {
                console.log('Reserved Number or GroupId or ChannelID Wrong!');
                 //从cmddata中去除错误数据
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
            var cmdPrefix = result[0].split(',')[0];
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
                console.log("Enter cmd Prefix condition......");
                //根据组号和通道号从ServiceCenter中首先找是否存在这样的一个通道号和组号,如果存在则判断是否位开关类型或者输入控制类型,是则更改状态,否则直接丢弃数据包
                if((typeof(servicecenter[recvgroupIdother]) !='undefined') && (typeof(servicecenter[recvgroupIdother][recvchanIdother]) != 'undefined'))
                {
                    cmddata = cmddata.substring(result[0].length);
                    if((typeof(servicecenter[recvgroupIdother][recvchanIdother]['channeltype']) !='undefined') && (servicecenter[recvgroupIdother][recvchanIdother]['channeltype']=='switch' || servicecenter[recvgroupIdother][recvchanIdother]['channeltype']=='inputcontrol'))
                    {
                        console.log("servicecenter["+recvgroupIdother+"]["+recvchanIdother+"].status = "+switchstatus);
                        servicecenter[recvgroupIdother][recvchanIdother]['service'].getCharacteristic(Characteristic.On).updateValue(switchstatus);
                    }
                    else
                    {
                        console.log("servicecenter["+recvgroupIdother+"]["+recvchanIdother+"] == 'undefined'"+"or channeltype is not switch or inputcontrol");
                    }
                    if(cmddata.length ==0)
                    {
                        return;
                    }
                    goon = true;
                    continue;
                }
                else
                {
                    
                    console.log("servicecenter["+recvgroupIdother+"]["+recvchanIdother+"] == 'undefined'");
                    //从cmddata中去除错误数据
                    cmddata = cmddata.substring(result[0].length);
    
                    if(cmddata.length ==0)
                    {
                        return;
                    }
                    goon = true;
                    continue;
                }
            }
            else
            {
                console.log("非C或S指令,可直接跳过");
                //从cmddata中去除不需处理的指令
                cmddata = cmddata.substring(result[0].length);
                if(cmddata.length ==0)
                {
                    return;
                }
                goon = true;
                continue;
            }
        }
        goon = false;
        console.log("Jumpout process------------");
    }
    
}
//--------------------------------------------------------------------------------------------
client.connect(port, host, function () {
    console.log('CONNECTED TO: ' + host + ':' + port);
    // 建立连接后立即向服务器发送数据，服务器将收到这些数据
    setInterval(function(){
        //每20秒向服务器发送心跳包
        var cmdheart = '*U;';
        console.log("send heartbeat packet :" + cmdheart);
        client.write(cmdheart);
    }, 20000);
});

// 为客户端添加“data”事件处理函数
// data是服务器发回的数据
client.on('data', function (data) {

    console.log("_____________________________________________________________")
    // console.log('Time: ' + new Date());
    // console.log("                                                            ");
    // console.log("| ---------------------------------------------------------|");
    // console.log("| RX DATA : "+ data);
    // console.log("| ---------------------------------------------------------|");
    // console.log("                                                            ");
    process(data);
    // var waitUntil = new Date(new Date().getTime() + 20 * 1000);
    // while(waitUntil > new Date()){}
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
    console.log("servicecenter Content:");
    //console.log(JSON.stringify(servicecenter,null,4));

    //test for update status on homekit

    // for (var key in servicecenter) {
    //     for(var innerkey in servicecenter[key])
    //     {
    //         servicecenter[key][innerkey].service.getCharacteristic(Characteristic.On).updateValue(cnt++%2);
    //     }
    // }
    
    // setTimeout(function(){
    //     client.connect(port, host, function() {

    //         console.log('CONNECTED TO: ' + host + ':' + port);
    //         // 建立连接后立即向服务器发送数据，服务器将收到这些数据 
    //         client.write('I am Chuck Norris!');
        
    //     });
    // },5000);
    setTimeout(function(){
        client.connect(port, host);
    },100);
    
});
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.UUIDGen;
    console.log("============================================");


    // console.log("Config Context : " + JSON.stringify(configobj['accessories']));
    console.log("++++++++++++++++++++++++++++++++++++++++++++");
    console.log("=============Total Accessory : "+configobj['accessories'].length+"================");

    for (var i = 0; i < configobj['accessories'].length; i++) {
        if ((configobj['accessories'][i]['name'].split('-')[2] == 'switch') || (configobj['accessories'][i]['name'].split('-')[2] =='inputcontrol')) {
            homebridge.registerAccessory("homebridge-switchcontroller", configobj['accessories'][i]['accessory'], HomebridgeSwitchController);
        }

        if (configobj['accessories'][i]['name'].split('-')[2] == 'bulb') {
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
    
    console.log("this.accessoryname :" + this.accessoryname);
    console.log("accessory :" + config["accessory"]);
    console.log("name :" + config["name"]);
    this.name = config["name"];
    this.groupId = config["groupId"];
    this.channelId = config["channelId"];
    this.channeltype = config["channeltype"];
}

HomebridgeSwitchController.prototype = {

    getSwitchState: function (next) {
        //console.log("next is " + next);
        console.log("getSwitchState====currentState:" + this.currentState);
        var CHANID = this.channelId+'';
        var GROUP = this.groupId;
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        var cmd = "*P,0," + GROUP + "," + CHANID + ";";
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
                    return next(null, this.currentState);
                }
            });
        // console.log(next);
        
    },
    setSwitchState: function (powerOn, next) {
        //console.log("next is " + next);
        console.log("setSwitchState=====powerOn : " + powerOn);
        
        var CHANID = this.channelId+'';
        var GROUP = this.groupId;
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

        //判断组号为键的对象是否还不存在,不存在则先创建
        //判断通道号为键的对象是否还不存在,不存在则先创建
        if(typeof(servicecenter[me.groupId]) == 'undefined')
        {
            servicecenter[me.groupId]={};
        }
        if(typeof(servicecenter[me.groupId][me.channelId]) == 'undefined')
        {
            servicecenter[me.groupId][me.channelId]={};
        }
        servicecenter[me.groupId][me.channelId]['service'] = switchService;
        servicecenter[me.groupId][me.channelId]['channeltype'] = me.channeltype;

        return [informationService, switchService];
    }
}

//--------------------------------------------------------------------------------------------------------------

function HomebridgeBrightnessController(log, config) {
    this.currentValue = 0;
    this.currentState = false;
    this.log = log;

    this.accessoryname = config["accessory"];
    
    console.log("this.accessoryname :" + this.accessoryname);
    console.log("accessory :" + config["accessory"]);
    console.log("name :" + config["name"]);
    this.name = config["name"];
    this.groupId = config["groupId"];
    this.channelId = config["channelId"];
    this.channeltype = config["channeltype"];
}

HomebridgeBrightnessController.prototype = {

    getBulbState: function (next) {
        console.log("getBulbState====currentState:" + this.currentState);
        // console.log(next);
        var CHANID = this.channelId+'';
        var GROUP = this.groupId;
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        var cmd = "*P,0," + GROUP + "," + CHANID + ";";
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
                return next(null, this.currentState);
            }
        });
        
    },
    setBulbState: function (powerOn, next) {
        console.log("setBulbState=====powerOn : " + powerOn);
        var CHANID = this.channelId+'';
        var GROUP = this.groupId;
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
        var CHANID = this.channelId;
        var GROUP = this.groupId;
        if (CHANID.length == 1) {
            CHANID = "0" + CHANID;
        }
        //console.log("Operation On " + GROUP + "-" + CHANID);
        var me = this;
        var cmd = "*A,0," + GROUP + "," + CHANID + ";*Z,0" + parseInt(brightnessValue*255/100).toString(16) + ";";
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

        //判断组号为键的对象是否还不存在,不存在则先创建
        //判断通道号为键的对象是否还不存在,不存在则先创建
        if(typeof(servicecenter[me.groupId]) == 'undefined')
        {
            servicecenter[me.groupId]={};
        }
        if(typeof(servicecenter[me.groupId][me.channelId]) == 'undefined')
        {
            servicecenter[me.groupId][me.channelId]={};
        }
	    servicecenter[me.groupId][me.channelId]['service'] = brightnessService;
        servicecenter[me.groupId][me.channelId]['channeltype'] = me.channeltype;

        return [informationService,brightnessService];
    }
}
