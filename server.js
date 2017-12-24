var http = require("http");
var    url = require("url");
var    path = require("path");
var    fs = require("fs");
var qs = require("querystring");
http.createServer(function(req, res) {
    console.log("__dirname = " + __dirname);
    var pathname = __dirname + url.parse(req.url).pathname;
    console.log("Receive path name : " + pathname);
    if (req.method.toUpperCase() == 'GET') {
        if (path.extname(pathname) == "" || pathname.charAt(pathname.length - 1) == "/") {
            console.log("Fisrt.........................");
            pathname = "/home/free/web/index.html";
        }
        else {
            pathname = "/home/free" + pathname;
        }
        console.log("pathname = " + pathname);

        if (path.isAbsolute(pathname)) {
            switch (path.extname(pathname)) {
                case ".html":
                    res.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                    break;
                case ".js":
                    res.writeHead(200, {
                        "Content-Type": "text/javascript"
                    });
                    break;
                case ".css":
                    res.writeHead(200, {
                        "Content-Type": "text/css"
                    });
                    break;
                case ".gif":
                    res.writeHead(200, {
                        "Content-Type": "image/gif"
                    });
                    break;
                case ".jpg":
                    res.writeHead(200, {
                        "Content-Type": "image/jpeg"
                    });
                    break;
                case ".png":
                    res.writeHead(200, {
                        "Content-Type": "image/png"
                    });
                    break;
                default:
                    res.writeHead(200, {
                        "Content-Type": "application/octet-stream"
                    });
            }

            fs.readFile(pathname, function (err, data) {
                res.end(data);
            });
        } else {
            res.writeHead(404, {
                "Content-Type": "text/html"
            });
            res.end("<h1>404 Not Found</h1>");
        }
    }
    else if (req.method.toUpperCase() == 'POST') {
        var strarray = pathname.split('/');
        var recvData = "";
        console.log("strarray is : " + strarray);
        if(strarray[strarray.length-1] == 'save')
        {
            req.on('data',function(data)
            {
                recvData +=data;
            })
            req.on('end',function()
            {
                var query = qs.parse(recvData);
                console.log("Query String:"+JSON.stringify(query));
                var configobj = JSON.parse(fs.readFileSync("/home/free/.homebridge/config.json"));
                configobj["accessory"][0]['HOST']=query["HOST"];
                configobj["accessory"][0]['GROUP']=query["GROUP"];
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify("status : ok"));
            })
        }
    }
    else
    {

    }

}).listen(8124, "192.168.1.108");
console.log("Server running at http://192.168.1.108:8124/");