var express = require('express');
var ws = require('nodejs-websocket');
var router = express.Router();

//game_var用于存放使用的变量
var game_var={
  players:[],//存放玩家信息（可用于信息发送）
  names:[],//存放玩家昵称
  numbers:[],//存放玩家对应序列号随机产生
  scores:[],//存放玩家对应分数
  status:[],//存放玩家状态
  board:[],
}

//game_2048用于存放使用的函数。
var game_2048 = {
  //加入新的玩家
  addPlayer:function(player){
    if(game_var.players.indexOf(player) != -1){
      player.sendText(JSON.stringify({
        type:"loginFail"
      }));
      return ;
    }
    var num = game_2048.randNumber();
    player.number = num;
    game_var.numbers.push(num);
    game_var.players.push(player);
    game_var.names.push(player.name);
    console.log("加人！");
    //console.log(game_var.players);
    //增加玩家初始分数0
    game_var.scores.push(0);
    //增加玩家初始状态:正在玩
    game_var.status.push(0);
    game_var.board.push([]);
    player.sendText(JSON.stringify({
      type:"loginSuccess",
      number: player.number,
    }));
    var msg = {
      type:"newPlayer",
      name: player.name,
      id: player.number,
      count: game_var.players.length,
    };
    msg = JSON.stringify(msg);
    game_var.players.forEach(function(current){
      current.sendText(msg);
    });
  },

  //每个玩家产生随机id
  randNumber:function(){
    var num = Math.floor(Math.random()*10000%9000 + 1000);
    while(game_var.numbers.indexOf(num) != -1){
      num = Math.floor(Math.random()*10000%9000 + 1000);
    }
    return num;
  },

  //移除退出的玩家
  removePlayer:function(player){
    var pos = game_var.players.indexOf(player);
    if(pos == -1)return ;
    game_var.numbers.splice(game_var.numbers.indexOf(player.number),1);
    game_var.players.splice(game_var.players.indexOf(player),1);
    // if(player.isInRoom){
    //   game_2048.leaveRoom(player);
    // }
    player.sendText(JSON.stringify({type:"logoutSuccess"}));
    var msg = {
      type:"playerLogout",
      name: player.name,
      id: player.number,
      count: game_var.players.length
    };
    msg = JSON.stringify(msg);
    game_var.players.forEach(function(current){
      current.sendText(msg);
    });
  },

  //分数排序
  rankdata:function(){
    temname = [];
    temscore = [];
    temstatus = [];
    temboard = [];
    for(i = 0;i < game_var.scores.length;i++){
      if(temscore.length == 0){
        temscore.push(game_var.scores[i]);
        temname.push(game_var.names[i]);
        temstatus.push(game_var.status[i]);
        temboard.push(game_var.board[i])
        console.log("temboard");
        console.log(temboard);
        continue;
      }
      j = 0;
      while(game_var.scores[i] < temscore[j]){
        j++;
      }
      temscore.splice(j,0,game_var.scores[i]);
      temname.splice(j,0,game_var.names[i]);
      temstatus.splice(j,0,game_var.status[i]);
      temboard.splice(j,0,game_var.board[i])
      
    }
    game_var.names = temname;
    game_var.scores = temscore;
    game_var.status = temstatus;
    game_var.board = temboard;
  },

  //对新入数据进行更新
  updatedata:function(player){

    //对应玩家把响应数据改入数组
    game_var.scores.splice(game_var.names.indexOf(player.name),1,player.score);
    game_var.status.splice(game_var.names.indexOf(player.name),1,player.status);
    game_var.board.splice(game_var.names.indexOf(player.name),1,player.board);

    //这里调用新函数进行排名工作
    console.log("sort");
    game_2048.rankdata();

    //服务器端向前端发送分数相关数据（格式转换+发送）
    var dataT=[];
    for(i = 0;i<game_var.scores.length;i++){
      var one = {};
      one.name = game_var.names[i];
      one.score = game_var.scores[i];
      one.status = game_var.status[i];
      one.board = game_var.board[i];
      dataT.push(one);
    }

    var msg = {
      type:"rank",
      data:dataT,
    };
    //console.log("有数据进来！");
    msg = JSON.stringify(msg);
    game_var.players.forEach(function(current){
      current.sendText(msg);
    });
  },

  //更新并发送时间
  sendtime:function(conn){
    var playtime = 1800;
    setInterval(function(){
      playtime--;
    },1000);
      var msg = {
        type:"time",
        duration: playtime,
      };
      msg = JSON.stringify(msg);
      conn.sendText(msg);
  },

  //更新聊天信息
  letschat:function(player,msg){
    if(game_var.players.indexOf(player) == -1)return ;
    var msg = {
      type:"letschat",
      name: player.name,
      str: msg
    };
    msg = JSON.stringify(msg);
    game_var.players.forEach(function(current){
      if(current!==player){
        current.sendText(msg);
      }
    });
  },

}

console.log("正在建立websocket");

ws.createServer(function(conn){
  conn.on("text",function(str){
    var msg = JSON.parse(str);
    game_2048.sendtime(conn);
    if(msg.type == "login"){
      conn.name = msg.name;
      game_2048.addPlayer(conn);
      console.log(conn.name+"["+conn.number+"]",str);
    } else if(msg.type == "logout"){
      game_2048.removePlayer(conn);
      console.log(conn.name+"["+conn.number+"]",str);
    } else if(msg.type=="data"){
      conn.name = msg.name;
      conn.score = msg.score;
      conn.status = msg.status;
      conn.board = msg.board;
      game_2048.updatedata(conn);
      console.log("分数更新");
    }else if(msg.type=="letschat"){
      conn.name = msg.name;
      game_2048.letschat(conn,msg.str);
      console.log(str);
    } 
  });
  
  conn.on("close",function(code,reason){
    game_2048.removePlayer(conn);
  });
  
  conn.on("error",function(code,reason){
    game_2048.removePlayer(conn);
  });
}).listen(3001);

console.log("websocket建立完成");
module.exports = function(app){
  app.get('/2048',function(req,res){
    res.render('index', { title: '' });
  });
};
