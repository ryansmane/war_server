const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Deck, Card } = require('./Deck');
const { Player } = require('./Player');
const port = 3001;
const ROOM_CAPACITY = 2;
const CARD_COUNT = 52;

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
         players: {
            [data.host]: new Player(socket.id),
         },
         readyPlayers: {},
      };
      socket.join(data.name);
      io.emit('return-rooms', rooms);
   });
   socket.on('init-one-player', (host) => {
      rooms[host].players[socket.id].initialized = true;
      let players = Object.values(rooms[host].players);
      if (players.filter((p) => p.initialized).length === players.length) {
         res = [];
         players.forEach((p) => {
            res.push({ id: p.id, length: p.deck.length });
         });
         io.to(rooms[host].name).emit('return-all-players', res);
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
         card: rooms[host].players[socket.id].getTopCard(),
         stack: rooms[host].players[socket.id].getDeckLength(),
      };
      io.to(rooms[host].name).emit('one-ready', {
         players: rooms[host].readyPlayers,
         roomCap: rooms[host].capacity,
      });
   });

   socket.on('refresh-cards', host => {
      let players = Object.values(rooms[host].readyPlayers);
      let winnings = [];
      let playersCopy = players.slice();
      players.forEach(p => {
         winnings.push(p.card);
      });
      playersCopy.sort((a, b) => b.card.pip - a.card.pip);
      let comparator = playersCopy.filter((p, i, a) => p.card.pip === a[0].card.pip).length;
      if (comparator === 1) {
         console.log('adding...')
         let winner = playersCopy[0].id;
         rooms[host].players[winner].addWinnings(winnings);
         rooms[host].readyPlayers = {};
      } else if (comparator > 1) {
         console.log('war!');
      }
   });

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

function getTop(players) {
   let topCards = [];
   players.forEach((p) => {
      topCards.push({ id: p.id, topCard: p.getTopCard() });
   });
   return topCards;
}

// function initPlayers(room) {
//     let players = [];
//     Object.values(room[players]).forEach(p => {
//         players.push({id: p.id, length: p.deck.length});
//     })
//     return players;
// }
