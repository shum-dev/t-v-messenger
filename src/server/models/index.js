const mongoose = require('mongoose');
mongoose.set('debug', true);
mongoose.Promise = Promise;
mongoose.connect('mongodb://localhost:28888/chatroom', {
  useNewUrlParser: true,
  useCreateIndex: true,
});

module.exports.User = require('./user');
module.exports.Message = require('./message');
module.exports.Room = require('./room');