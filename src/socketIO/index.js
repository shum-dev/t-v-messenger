import io from 'socket.io-client';

const socketUrl = 'http://localhost:3231';

let socket;
function createConnection() {
  socket = io(socketUrl);
}

export {
  socket,
  createConnection
}