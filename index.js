const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = 3001;
const ROOM_CAPACITY = 2;

let rooms = [];


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    socket.emit('return-rooms', rooms);

    socket.emit('new-user', socket.id);

    socket.on('create-room', data => {
       rooms.push(data);
       io.emit('return-rooms', rooms); 
       socket.join(data.host);
    })

    socket.on('join-room', host => {
        socket.join(host);
        rooms.map((r, i) => {
            if (r.host == host) {
                r.members += 1;
                if (r.members == ROOM_CAPACITY) {
                   io.to(host).emit('new-deck', [2, 3, 4]);
                }
            }
        })
        io.emit('return-rooms', rooms); 
        
    })

    socket.on('disconnect', () => {
        if (rooms.filter(r => r.host == socket.id).length > 0) {
            rooms = rooms.filter(r => r.host !== socket.id);
            io.emit('return-rooms', rooms);
        }
    })
});

http.listen(port, () => {
    console.log(`listening on ${port}`);
});