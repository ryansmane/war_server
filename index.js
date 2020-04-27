const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const {Deck, Card} = require('./Deck');
const port = 3001;
const ROOM_CAPACITY = 4;
const CARD_COUNT = 52;

let rooms = [];


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('new user')
    socket.emit('return-rooms', rooms);
    socket.emit('new-user', socket.id)

    socket.on('create-room', data => {
       
       rooms.push(data);
       io.emit('return-rooms', rooms); 
       socket.join(data.name);
    })

    socket.on('join-room', data => {
        socket.join(data.name);

        rooms.map(r => {
            if (r.name == data.name) {
                r.players.push(data.player)
                if (r.players.length == ROOM_CAPACITY) {
                   let a = new Deck();
                   a.genShuffledDeck()
                   for (let i = 0; i < r.players.length; i++) {
                        r.players[i].deck = a.deck.splice(0, CARD_COUNT/ROOM_CAPACITY);
                    }

                    io.to(data.name).emit('get-all-players', r);

                }
            }
        })

        io.emit('return-rooms', rooms); 
        
    })

    socket.on('clicked', data => {
        rooms.map(r => {
            if (r.name === data.name) {
                r.players.map(p => {
                    if (p.id === data.id) {
                        p.clicked = true;
                    }
                })
            }
            if (allClicked(r.players)) {
                r.players.forEach(player => {
                    player.clicked = false;
                })
                let res = manipulateDecks(r.players);
                r.players = res.players
                io.to(data.name).emit('return-after-click', {players: r.players, all: true});
                
            } else {
                io.to(data.name).emit('return-after-click', {players: r.players, all: false});
            }
        })
    })

    socket.on('disconnect', () => {
        console.log('disconnected')
        if (rooms.filter(r => r.host == socket.id).length > 0) {
            rooms = rooms.filter(r => r.host !== socket.id);
            io.emit('return-rooms', rooms);
        }
    })
});

http.listen(port, () => {
    console.log(`listening on ${port}`);
});

function allClicked(players, room_cap = null) {
    let filtered = players.filter(p => p.clicked === true);
    return filtered.length === ROOM_CAPACITY; 
}

function manipulateDecks(players) {
    let topCards = [];
    let winnings = [];
    players.forEach(p => {
        let t = p.deck.shift()
        topCards.push({id: p.id, topCard: t});
        winnings.push(t);
    })

    topCards.sort((a, b) => b.topCard.pip - a.topCard.pip);

    let winner = topCards[0].id;

    players.map(p => {
        if (p.id == winner) {
            p.deck = p.deck.concat(winnings)
        }
    })
 
    return {players, winner};
}