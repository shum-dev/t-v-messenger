var app = require('http').createServer();
var io = module.exports.io = require('socket.io')(app);
const onConnect = require('./onConnect');

const PORT = process.env.PORT || 3231;

io.on('connection', onConnect);

app.listen(PORT, () => {
  console.log('Listening on PORT: ', PORT);
});