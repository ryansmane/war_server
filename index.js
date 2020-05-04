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
            [data.host]: new Player(socket.id),
         },
         initPlayers: {},
         deckLengths: {},
         readyPlayers: {},
      };
      socket.join(data.name);
      io.emit('return-rooms', rooms);
   });

   socket.on('init-one-player', (host) => {
      rooms[host].players[socket.id].initialized = true;
      let players = Object.values(rooms[host].players);
      if (players.filter((p) => p.initialized).length === players.length) {
         players.forEach((p) => {
            rooms[host].initPlayers[p.id] = { id: p.id, active: true };
         });
         setDeckLengths(host);
         io.to(rooms[host].name).emit('return-all-players', { players: Object.values(rooms[host].initPlayers), deckLengths: rooms[host].deckLengths});
      }
   });

   socket.on('join-room', (data) => {
      rooms[data.host].players[socket.id] = new Player(socket.id);
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
         card: rooms[host].players[socket.id].getTopCard()
      }
      io.to(rooms[host].name).emit('one-ready', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity
      });
   });

   socket.on('refresh-cards', host => {
      let c = compare(host);
      let comparator = c.comparator;
      let winnings = c.winnings;
      let playersCopy = c.playersCopy;

      if (comparator === 1) {
         let winner = playersCopy[0].id;
         rooms[host].players[winner].addWinnings(winnings);
         let check = checkForEmpty(host, socket.id);
         if (check.flag) {
            io.to(rooms[host].name).emit('return-all-players', { players: Object.values(rooms[host].initPlayers), deckLengths: rooms[host].deckLengths, deactivate: check.deactivate})
            updateDeckLengths(host);
            rooms[host].readyPlayers = {};
            io.to(rooms[host].name).emit('one-ready', {
                  winner: winner,
                  players: rooms[host].readyPlayers,
                  roomCap: rooms[host].capacity,
                  deckLengths: rooms[host].deckLengths,
            });
         
         } else {
         updateDeckLengths(host);
         rooms[host].readyPlayers = {};
         io.to(rooms[host].name).emit('one-ready', {
            winner: winner,
            players: rooms[host].readyPlayers,
            roomCap: rooms[host].capacity,
            deckLengths: rooms[host].deckLengths,
         })};
      } else if (comparator > 1) {
         let warPlayers = getNewPlayersObject(playersCopy, host, comparator);
         rooms[host].warBounty = winnings;
         rooms[host].warringPlayers = warPlayers;
         io.to(rooms[host].name).emit('war', warPlayers);
         
      }
   });

   socket.on('need-resolution', data => {
      let host = data.host
      let warrers = data.warringPlayers;
      let w = rooms[host].players[socket.id].removeTopCards();
      rooms[host].warBounty = rooms[host].warBounty.concat(w);
      let t = rooms[host].players[socket.id].getTopCard();
      if (t !== null) {
      rooms[host].readyPlayers[socket.id] = {
         id: socket.id,
         card: t,
         changed: true
         }
      } else {
         delete warrers[socket.id];
      } 

      delete rooms[host].warringPlayers[socket.id];

      if (_.isEmpty(rooms[host].warringPlayers)) {
         let players = Object.values(rooms[host].readyPlayers);
         let winnings = [];
         let playersCopy = players.slice();
         players.forEach(p => {
            if (warrers[p.id]) {
            winnings.push(p.card);
            }
         });
         playersCopy.sort((a, b) => b.card.pip - a.card.pip);
         let comparator = playersCopy.filter((p, i, a) => p.card.pip === a[0].card.pip && warrers[p.id]).length;
         if (comparator === 1) {
            let winner = playersCopy[0].id;
            rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
            rooms[host].players[winner].addWinnings(rooms[host].warBounty);
            rooms[host].warBounty = [];
            warHistory = Object.assign({}, rooms[host].readyPlayers);
            rooms[host].readyPlayers = {};
            let check = checkForEmpty(host, socket.id);
            if (check.flag) {
               io.to(rooms[host].name).emit('return-all-players', { players: Object.values(rooms[host].initPlayers), deckLengths: rooms[host].deckLengths, deactivate: check.deactivate })
               updateDeckLengths(host);
               io.to(rooms[host].name).emit('resolved', {
                     players: rooms[host].readyPlayers,
                     roomCap: rooms[host].capacity,
                     deckLengths: rooms[host].deckLengths,
                     warHistory: warHistory,
                     winner: winner
               });
               
            } else {
            updateDeckLengths(host);
            io.to(rooms[host].name).emit('resolved', {
               players: rooms[host].readyPlayers,
               roomCap: rooms[host].capacity,
               deckLengths: rooms[host].deckLengths,
               warHistory: warHistory,
               winner: winner
            })};
         } else if (comparator > 1) {
            let check = checkForEmpty(host, socket.id);
            if (check.flag) {
               io.to(rooms[host].name).emit('return-all-players', { players: Object.values(rooms[host].initPlayers), deckLengths: rooms[host].deckLengths, deactivate: check.deactivate })
            }
            let warrersCopy = Object.values(warrers).slice();
            let warPlayers = getNewPlayersObject(warrersCopy, host, comparator);
            rooms[host].warBounty = rooms[host].warBounty.concat(winnings);
            rooms[host].warringPlayers = warPlayers;
            players.forEach(p => {
               p.changed = false;
            })
            console.log(warPlayers);
            io.to(rooms[host].name).emit('war', {players: rooms[host].readyPlayers, warPlayers: warPlayers});

         }
      } else {
      
      io.to(rooms[host].name).emit('one-ready', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity,
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
   for (let i = 0; i < values.length; i++) {
      values[i].deck = d.splice(0, 52/cap);
   }
}

function getNewPlayersObject(copy, host, comp) {
   let players = {};
   for (let i = 0; i < comp; i++) {
      players[copy[i].id] = rooms[host].readyPlayers[copy[i].id];
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
   let players = Object.values(rooms[host].players);
   let filtered = players.filter(p => p.getDeckLength() === 0);
   if (filtered.length === 0) {
      return {flag: false};
   } else if (filtered.length > 0) {
      console.log('here')
      let deactivate = false;
      for (let i = 0; i < filtered.length; i++) {
         if (filtered[i].id === id) {
            deactivate = true;
         }
         rooms[host].initPlayers[filtered[i].id].active = false;
      }
      rooms[host].capacity -= filtered.length;
      return {flag: true, deactivate: deactivate};
   }
   
}