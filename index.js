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
        console.log(data)

        socket.join(data.name);

        rooms.map(r => {
            if (r.name == data.name) {
                console.log(r)
                r.players.push(data.player)
                console.log(r)
                if (r.players.length == ROOM_CAPACITY) {
                   let a = new Deck();
                   a.genShuffledDeck()
                   for (let i = 0; i < r.players.length; i++) {
                        r.players[i].deck = a.deck.splice(0, CARD_COUNT/ROOM_CAPACITY);
                    }
                    console.log(r)
                    io.to(data.name).emit('get-all-players', r);
                    console.log(r)
                }
            }
        })

        io.emit('return-rooms', rooms); 
        
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