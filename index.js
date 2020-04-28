const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const {Deck, Card} = require('./Deck');
const port = 3001;
const ROOM_CAPACITY = 2;
const CARD_COUNT = 52;

let rooms = {};


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('new user')
    socket.emit('return-rooms', rooms);

    socket.on('create-room', data => {
       
       rooms[data.host] = {
           capacity: data.capacity,
           name: data.name, 
           host: data.host,
           players: {
            [data.host]: data.player   
           }
       }
       socket.join(data.name);
       io.emit('return-rooms', rooms); 

       
    })

       socket.on('join-room', data => {
         rooms[data.host].players[socket.id] = data.player;
         socket.join(data.name);
         if (Object.keys(rooms[data.host].players).length == rooms[data.host].capacity) {
            io.to(data.name).emit('all-players-in', data.host)
         }
         io.emit('return-rooms', rooms);

       })

       socket.on('ready-up', host => {
           rooms[host].players[socket.id].ready = true;
           if (Object.values(rooms[host].players).filter(p => p.ready === true).length === rooms[host].capacity) {
               assignDecks(rooms[host.players]);
               io.to(rooms[host].name).emit('all-ready', rooms[host]);
           }
       })
    // socket.on('join-room', data => {
    //     socket.join(data.name);

    //     rooms.map(r => {
    //         if (r.name == data.name) {
    //             r.players.push(data.player)
    //             if (r.players.length == ROOM_CAPACITY) {
    //                let a = new Deck();
    //                a.genShuffledDeck()
    //                for (let i = 0; i < r.players.length; i++) {
    //                     r.players[i].deck = a.deck.splice(0, CARD_COUNT/ROOM_CAPACITY);
    //                 }

    //                 io.to(data.name).emit('get-all-players', r);

    //             }
    //         }
    //     })

    //     io.emit('return-rooms', rooms); 
        
    // })

    // socket.on('clicked', data => {
    //     rooms.map(r => {
    //         if (r.name === data.name) {
    //             r.players.map(p => {
    //                 if (p.id === data.id) {
    //                     p.clicked = true;
    //                 }
    //             })
    //         }
    //         if (allClicked(r.players)) {
    //             r.players.forEach(player => {
    //                 player.clicked = false;
    //             })
    //             let res = manipulateDecks(r.players);
    //             r.players = res.players;
    //             if (res.thereWasAWar) {
    //                 io.to(data.name).emit('return-after-click', {
    //                    players: r.players,
    //                    all: true,
    //                    thereWasAWar: res.thereWasAWar,
    //                    eventualWinner: res.eventualWinner,
    //                    wars: res.wars
    //                 });
    //             } else {
    //                 io.to(data.name).emit('return-after-click', {
    //                    players: r.players,
    //                    thereWasAWar: res.thereWasAWar,
    //                    all: true,
    //                    winner: res.winner,
    //                 });
    //             }
                
                
                
    //         } else {
    //             io.to(data.name).emit('return-after-click', {players: r.players, all: false, winner: null});
    //         }
    //     })
    // })

    socket.on('disconnect', () => {
        console.log('disconnected')
        if (rooms[socket.id]) {
            delete rooms[socket.id];
            io.emit('return-rooms', rooms)
        }
    })
});

http.listen(port, () => {
    console.log(`listening on ${port}`);
});

// function allClicked(players, room_cap = null) {
//     let filtered = players.filter(p => p.clicked === true);
//     return filtered.length === ROOM_CAPACITY; 
// }
function assignDecks(players) {

}
// function manipulateDecks(players) {
//     let topCards = [];
//     let winnings = [];
//     let thereWasAWar = false;
    
//     players.forEach(p => {
//         let t = p.deck.shift()
//         topCards.push({id: p.id, topCard: t});
//         winnings.push(t);
//     })

//     topCards.sort((a, b) => b.topCard.pip - a.topCard.pip);

//     //array of object {playerID, their top card}
//     let warCheck = topCards.filter((c,i,a) => c.topCard.pip === a[0].topCard.pip);
//     console.log(warCheck)
//     if (warCheck.length > 1) {
//         topCards = [];
//         let winner;
//         thereWasAWar = true;
//         let eventualWinner;
//         let wars = [];
//         let bounties = [];
//         wars.push([]);
//         index = 0;
//         while (warCheck.length > 1)
//          {
//              warCheck.forEach((obj) => {
                 
//                 players.map(p => {
//                     if (p.id == obj.id) {
                        
//                         bounties.push(p.deck.shift());
//                         bounties.push(p.deck.shift());
//                         bounties.push(p.deck.shift());
//                         let t = p.deck.shift();
//                         topCards.push({id: p.id, topCard: t});
//                         wars[index].push({id: p.id, threeShowing: bounties, newTop: t})
                        
//                     }
//                 })

//             })
//             topCards.sort((a, b) => b.topCard.pip - a.topCard.pip);

    
//             warCheck = topCards.filter((c,i,a) => c.topCard.pip === a[0].topCard.pip);
//             index++;
//         } 
//         eventualWinner = topCards[0].id;

//         for (let i = 0; i < wars.length; i++) {
//             winnings.push(wars[i].newTop);
//             for (let k = 0; k < wars[i].threeShowing.length; k++) {
//                 winnings.push(wars[i].threeShowing[k]);
//         }
        
//     }
//     players.map((p) => {
//             if (p.id == winner) {
//                 p.deck = p.deck.concat(winnings);
//             }
//         });
    
//     } else {
//         winner = topCards[0].id;

//         players.map((p) => {
//             if (p.id == winner) {
//                 p.deck = p.deck.concat(winnings);
//             }
//         });
//     }
 
//     return thereWasAWar ? {players, thereWasAWar, eventualWinner, wars} : {players, thereWasAWar, winner};
// }