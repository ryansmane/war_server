const app = require('express')();
const http = require('http').createServer(app);
const _ = require('lodash');
const io = require('socket.io')(http);
const { Deck } = require('./Deck');
const { Player } = require('./Player');
const port = 3001;

let rooms = {};

app.get('/', (req, res) => {
   res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
   console.log('new user');
   socket.emit('return-rooms', rooms);

   socket.on('create-room', (data) => {
      rooms[data.host] = {
         capacity: data.capacity,
         name: data.name,
         host: data.host,
         warringPlayers: {},
         warBounty: [],
         players: {
            [data.host]: new Player(socket.id, data.desiredName)
         },
         initPlayers: {},
         deckLengths: {},
         readyPlayers: {},
         deactivationMap: {}
      };
      socket.join(data.name);
      io.emit('return-rooms', rooms);
   });

   socket.on('init-one-player', (host) => {
      rooms[host].players[socket.id].initialized = true;
      let players = Object.values(rooms[host].players);
      if (players.filter((p) => p.initialized).length === players.length) {
         players.forEach((p) => {
            rooms[host].initPlayers[p.id] = { id: p.id, active: true, name: p.name };
         });
         setDeckLengths(host);
         console.log(rooms[host].players[socket.id].name);
         io.to(rooms[host].name).emit('return-all-players', { players: rooms[host].initPlayers, deckLengths: rooms[host].deckLengths});
      }
   });

   socket.on('join-room', (data) => {
      rooms[data.host].players[socket.id] = new Player(socket.id,data.desiredName);
      socket.join(data.name);
      if (
         Object.keys(rooms[data.host].players).length ==
         rooms[data.host].capacity
      ) {
         let d = new Deck();
         d.shuffle()
         assignDecks(rooms[data.host].players, d.deck, rooms[data.host].capacity);
         io.to(data.name).emit('all-players-in', data.host);
      }
      io.emit('return-rooms', rooms);
   });

   socket.on('ready-up', (host) => {
         rooms[host].readyPlayers[socket.id] = {
         id: socket.id,
         card: rooms[host].players[socket.id].getTopCard(),
         changed: true
      }
      updateDeckLengths(host);
      io.to(rooms[host].name).emit('one-ready', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity - Object.values(rooms[host].deactivationMap).length,
         deckLengths: rooms[host].deckLengths
      });  
   });

   socket.on('refresh-cards', host => {
     refresh(host, socket.id);
   });

   socket.on('need-resolution', data => {
      let host = data.host
      let warrers = data.warringPlayers;
      rooms[host].warBounty = rooms[host].warBounty.concat(rooms[host].players[socket.id].removeTopCards());
      
      rooms[host].readyPlayers[socket.id] = {
         id: socket.id,
         card: rooms[host].players[socket.id].getTopCard(),
         changed: true
         }


      delete rooms[host].warringPlayers[socket.id];

      if (_.isEmpty(rooms[host].warringPlayers)) {
         resolveWar(host, warrers, socket.id);
      } else {
         updateDeckLengths(host);
         io.to(rooms[host].name).emit('one-ready', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity - rooms[host].deactivationMap.length,
         deckLengths: rooms[host].deckLengths,
         war: true
         });
      } 
   })

   socket.on('disconnect', () => {
      console.log('disconnected');
      if (rooms[socket.id]) {
         delete rooms[socket.id];
         io.emit('return-rooms', rooms);
      }
   });
});

http.listen(port, () => {
   console.log(`listening on ${port}`);
});

function assignDecks(players, d, cap) {
   let values = Object.values(players);
   let size = d.length;
   let rand = Math.random();
   let rem = size % cap;
   if (rem === 0) {
   for (let i = 0; i < values.length; i++) {
      values[i].deck = d.splice(0, size/cap);
      }
   } else if (rem > 0) {
      for (let i = 0; i < values.length; i++) {
         values[i].deck = d.splice(0, (size - rem)/cap);
      }
      if (rand >= .5) {
      for (let i = 0; i < rem; i++) {
         values[i].deck.push(d[i]);
         }
      } else {
         for (let i = rem-1; i >= 0; i--) {
            values[i].deck.push(d[i]);
         }
      }
   }
}

function getWarPlayers(copy, host, comp) {
   let players = {};
   for (let i = 0; i < comp; i++) {
      if (rooms[host].deckLengths[copy[i].id] > 0) {
      players[copy[i].id] = rooms[host].readyPlayers[copy[i].id];
      }
   }
   return players;
}

function setDeckLengths(host) {
   let players = Object.values(rooms[host].players);
   obj = {};
   players.forEach(p => {
      obj[p.id] = p.getDeckLength();
   })
   rooms[host].deckLengths = obj;
}

function updateDeckLengths(host) {
   let players = Object.keys(rooms[host].deckLengths);
   for (let i = 0; i < rooms[host].capacity; i++) {
      rooms[host].deckLengths[players[i]] = rooms[host].players[players[i]].getDeckLength();
   }
}

function compare(host) {
   let players = Object.values(rooms[host].readyPlayers);
   let winnings = [];
   let playersCopy = players.slice();
   players.forEach(p => {
      winnings.push(p.card);
   });
   playersCopy.sort((a, b) => b.card.pip - a.card.pip);
   let comparator = playersCopy.filter((p, i, a) => p.card.pip === a[0].card.pip).length;
   return {comparator, winnings, playersCopy};
}

function checkForEmpty(host, id) {
   let players = Object.keys(rooms[host].initPlayers);
   let flag = false;
   for (let i = 0; i < players.length; i++) {
      if (rooms[host].deckLengths[players[i]] === 0) {
         if (!rooms[host].deactivationMap[players[i]]) {
            flag = true;
            rooms[host].deactivationMap[players[i]] = players[i];
         }
      }
   }
   return flag;
}

function refresh(host, id) {
   let c = compare(host);
   let comparator = c.comparator;
   let winnings = c.winnings;
   let playersCopy = c.playersCopy;
   if (comparator === 1) {
      let winner = playersCopy[0].id;
      rooms[host].players[winner].addWinnings(winnings);
      updateDeckLengths(host);
      let flag = checkForEmpty(host);
      rooms[host].readyPlayers = {};
      let l = Object.values(rooms[host].deactivationMap).length;
      io.to(rooms[host].name).emit('resolved', {
         winner: winner,
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity - l,
         deckLengths: rooms[host].deckLengths,
         deactivationMap: !flag ? false : rooms[host].deactivationMap,
         ultimateWinner: Object.values(rooms[host].deactivationMap).length === rooms[host].capacity - 1 ? true : false
      });
   } else if (comparator > 1) {
      updateDeckLengths(host)
      let warPlayers = getWarPlayers(playersCopy, host, comparator);
      rooms[host].warBounty = winnings;
      if (Object.values(warPlayers).length === 1) {
         let winner = Object.values(warPlayers)[0].id;
         rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
         rooms[host].players[winner].addWinnings(rooms[host].warBounty);
         rooms[host].warBounty = [];
         Object.values(rooms[host].readyPlayers).forEach(p => p.changed = true);
         rooms[host].readyPlayers = {};
         updateDeckLengths(host);
         let flag = checkForEmpty(host);
         let l = Object.values(rooms[host].deactivationMap).length;
         io.to(rooms[host].name).emit('resolved', {
            players: rooms[host].readyPlayers,
            roomCap: rooms[host].capacity - l,
            deckLengths: rooms[host].deckLengths,
            winner: winner,
            deactivationMap: !flag ? false : rooms[host].deactivationMap,
            ultimateWinner: Object.values(rooms[host].deactivationMap).length === rooms[host].capacity - 1 ? true : false
         })
      }
      else {
      rooms[host].warringPlayers = warPlayers;
      let flag = checkForEmpty(host);
      Object.values(rooms[host].readyPlayers).forEach(p => p.changed = false);
      io.to(rooms[host].name).emit('war', { players: rooms[host].readyPlayers, warPlayers: warPlayers, deckLengths: rooms[host].deckLengths, deactivationMap: !flag ? false : rooms[host].deactivationMap});
      }
   }
}

function resolveWar(host, warrers, id) {
   let players = Object.values(rooms[host].readyPlayers);
   let winnings = [];
   let playersCopy = players.slice();
   console.log('winnings before foreach: ' + winnings)
   players.forEach(p => {
      if (warrers[p.id]) {
         winnings.push(p.card);
      }
   });
   console.log('winnings after foreach: ' + winnings)
   playersCopy.sort((a, b) => b.card.pip - a.card.pip);
   let comparator = playersCopy.filter((p, i, a) => p.card.pip === a[0].card.pip && warrers[p.id]).length;
   if (comparator === 1) {
      let winner = playersCopy[0].id;
      rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
      rooms[host].players[winner].addWinnings(rooms[host].warBounty);
      rooms[host].warBounty = [];
      Object.values(rooms[host].readyPlayers).forEach(p => p.changed = true);
      warHistory = Object.assign({}, rooms[host].readyPlayers);
      rooms[host].readyPlayers = {};
      updateDeckLengths(host);
      let flag = checkForEmpty(host);
      let l = Object.values(rooms[host].deactivationMap).length;
      io.to(rooms[host].name).emit('resolved', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity - l,
         deckLengths: rooms[host].deckLengths,
         warHistory: warHistory,
         winner: winner,
         deactivationMap: !flag ? false : rooms[host].deactivationMap,
         ultimateWinner: Object.values(rooms[host].deactivationMap).length === rooms[host].capacity - 1 ? true : false
      })
   } else if (comparator > 1) {
      updateDeckLengths(host);
      let warPlayers = getWarPlayers(playersCopy, host, comparator);
      rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
      if (Object.values(warPlayers).length === 1) {
         let winner = Object.values(warPlayers)[0].id;
         rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
         rooms[host].players[winner].addWinnings(rooms[host].warBounty);
         rooms[host].warBounty = [];
         Object.values(rooms[host].readyPlayers).forEach(p => p.changed = true);
         warHistory = Object.assign({}, rooms[host].readyPlayers);
         rooms[host].readyPlayers = {};
         updateDeckLengths(host);
         let flag = checkForEmpty(host);
         let l = Object.values(rooms[host].deactivationMap).length;
         io.to(rooms[host].name).emit('resolved', {
            players: rooms[host].readyPlayers,
            roomCap: rooms[host].capacity - l,
            deckLengths: rooms[host].deckLengths,
            warHistory: warHistory,
            winner: winner,
            deactivationMap: !flag ? false : rooms[host].deactivationMap,
            ultimateWinner: Object.values(rooms[host].deactivationMap).length === rooms[host].capacity - 1 ? true : false
         })
      }
      else {
         rooms[host].warringPlayers = warPlayers;
         let flag = checkForEmpty(host);
         Object.values(rooms[host].readyPlayers).forEach(p => p.changed = false);
         updateDeckLengths(host);
         io.to(rooms[host].name).emit('war', { players: rooms[host].readyPlayers, warPlayers: warPlayers, deckLengths: rooms[host].deckLengths, deactivationMap: !flag ? false : rooms[host].deactivationMap });
      }
   
   }
}