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
           assigned: data.assigned,
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
           let res;
           rooms[host].players[socket.id].ready = true;
           if (Object.values(rooms[host].players).filter(p => p.ready === true).length === rooms[host].capacity) {
               if (!rooms[host].assigned) {
               assignDecks(rooms[host].players);
               rooms[host].assigned = true;
               }
               Object.values(rooms[host].players).forEach(player => {
                   player.ready = false;
               })
               res = getRelevantCards(rooms[host].players);
               io.to(rooms[host].name).emit('all-ready', res);
           }
        //    else {
        //        io.to(rooms[host].name).emit('one-ready', socket.id)
        //    }
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


function assignDecks(players) {
    let values = Object.values(players);
    for (let i = 0; i < values.length; i++) {
        d = new Deck();
        d.shuffle();
        values[i].deck = d.deck;
    }
}

function getRelevantCards(players) {
    let values = Object.values(players);
    let info = [];
    let winnings = [];
    for (let i = 0; i < values.length; i++) {
        let popped = values[i].deck.pop();
        winnings.push(popped)
        info.push({id: values[i].id, top: popped});
    }
    let data = weHaveAWar(info);
    
    if (data.flag) {
        let warInfo = [info]
        do {
        let newInfo = [];
        data.playersAtWar.forEach(player => {
            winnings.push(players[player.id].deck.pop());
            winnings.push(players[player.id].deck.pop());
            winnings.push(players[player.id].deck.pop());
        })
        data.playersAtWar.forEach(player => {
            let popped = players[player.id].deck.pop();
            winnings.push(popped)
            newInfo.push({id: player.id, top: popped});
        })
        data = weHaveAWar(newInfo); 
        warInfo.push(newInfo);
        } while (data.flag);
        players[data.winner].deck = winnings.concat(players[data.winner].deck);
        return {info: warInfo, winner: data.winner, warFlag: true};
    } else {
        players[data.winner].deck = winnings.concat(players[data.winner].deck);
        return {info: info, winner: data.winner, warFlag: false};
    }
}

function weHaveAWar(info) {
    info.sort((a, b) => b.top.pip - a.top.pip);
    let first = info[0].top.pip;
    let filtered = info.filter(obj => obj.top.pip == first);
    console.log(filtered)
    return filtered.length > 1 ? {playersAtWar: filtered, flag: true} : {winner: filtered[0].id, flag: false}
}


