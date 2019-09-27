const io = require('./index').io;
const db = require('./models');
const { VERIFY_USER, CREATE_NEW_ROOM, CREATE_NEW_MESSAGE,
        ADD_NEW_MESSAGE, ROOM_ACCESS, FETCH_USER_DATA, UNSUBSCRIBE,
        JOIN_ROOM, EXIT_ROOM, SIGNAL, STREAMING } = require('../Events');

// Create generic room for all users
(async function initGenericRoom(){
  let genericRoom;
  try {
    genericRoom = await db.Room.findOne({ name: 'Generic' });
    if(!genericRoom){
      genericRoom = await db.Room.create({name: 'Generic'});
    }
  } catch(ignore){}
}());

let ROOMS_ACTIVITY;

module.exports = function(socket){
  console.log(`Socket ID: ${socket.id} connected!`);

  // initially fetch user data from DB
  socket.on(FETCH_USER_DATA, async (user, location, callback) => {
    console.log('Location: ', location);
    try {
      let foundUser = await db.User.findOne({name: user}).populate({
        path: 'rooms',
        populate: {
          path: 'messages',
          populate: { path: 'user'}
        }
      }).populate({
        path: 'rooms',
        populate: { path: 'users' }
      });
      if(foundUser){
        // initially subscribe user to existing rooms
        foundUser.rooms.forEach(room => {
          socket.join(room.id);
        });
        // if there is a match roomID/URL path set active chat
        let foundChat = foundUser.rooms.filter(room => room.id === location)[0];
        callback({user: foundUser, activeChat: foundChat});
      } else {
        callback({user: null});
      }
    } catch(err) {
      console.log('Something goes wrong in FETCH_USER_DATA ', err);
    }
  });
  // veryfy if passed-in user exist
  socket.on(VERIFY_USER, async (nickname, callback) => {
    let user;
    try {
        user = await db.User.findOne({name: nickname}).populate({
          path: 'rooms',
          populate: {
            path: 'messages',
            populate: { path: 'user'}
          }
        }).populate({
          path: 'rooms',
          populate: { path: 'users' }
        });
        // if exist subscribe to all rooms in a list
      if(user){
        let { rooms } = user;
        rooms.forEach(item => {
          socket.join(item.id);
        });
        callback({user, error: false});
        // if unknown user: Create one, Add to Generic room
      } else {
        user = await db.User.create({name: nickname});
        let foundRoom = await db.Room.findOne({name: 'Generic'});
        foundRoom.users.push(user.id);
        user.rooms.push(foundRoom.id);
        socket.join(foundRoom.id); // subscribe current socket to Generic room
        await foundRoom.save();
        await user.save();
        let foundUser = await db.User.findById(user.id).populate({
          path: 'rooms',
          populate: {
            path: 'messages',
            populate: { path: 'user'}
          }
        }).populate({
          path: 'rooms',
          populate: { path: 'users' }
        });
        callback({user: foundUser, err: false}); // send populated data to client
      }
    } catch(error) {
      console.log('Something went wrong in VERIFY_USER: ', error);
      callback({user: null, error})
    }
  });

  socket.on(CREATE_NEW_ROOM, async (newRoomName, userName, callback) => {
    try {
      let newRoom = await db.Room.create({name: newRoomName});
      let user = await db.User.findOne({name: userName});
      user.rooms.push(newRoom);
      newRoom.users.push(user.id);
      socket.join(newRoom.id); // subscribe current socket to New room
      await user.save();
      await newRoom.save();
      let foundUser = await db.User.findOne({name: userName}).populate({
        path: 'rooms',
        populate: {
          path: 'messages',
          populate: { path: 'user'}
        }
      }).populate({
        path: 'rooms',
        populate: { path: 'users' }
      });
      callback(foundUser);
    } catch(err) {
      console.log('Somethisng went wrong in CREATE_NEW_ROOM');
    }
  });

  socket.on(CREATE_NEW_MESSAGE, async ({roomId, message, userId}) => {
    try {
      let newMsg = await db.Message.create({text: message, user: userId});
      let id = newMsg._id;
      let room = await db.Room.findById(roomId);
      room.messages.push(id);
      await room.save();
      let foundRoom = await db.Room.findById(roomId).populate({
        path: 'users',
      }).populate({
        path: 'messages',
        populate: {
          path: 'user'
        }
      });
      // broadcast to all subscribers about new created message in room
      io.to(roomId).emit(ADD_NEW_MESSAGE, foundRoom);
    } catch(err) {
      console.log('Something went wrong in CREATE_NEW_MESSAGE: ', err);
    }
  });

  socket.on(ROOM_ACCESS, async (roomId, userName, callback) => {
    try {
      let room = await db.Room.findById(roomId).populate({ path: 'users' });
      if(room){ // if passed-in room exist
        let user = await db.User.findOne({name: userName}).populate({
          path: 'rooms',
          populate: {
            path: 'messages',
            populate: { path: 'user'}
          }
        }).populate({
          path: 'rooms',
          populate: { path: 'users' }
        });
        // and user don't enjoi it yet
        if(room.users.some(item => item.name === userName)){
          callback(foundUser, roomId);
          return;
        }
        // add user to the room, room to the user
        user.rooms.push(room);
        room.users.push(user.id);
        socket.join(room.id); // subscribe user to this room
        await user.save();
        await room.save();

        let foundUser = await db.User.findOne({name: userName}).populate({
          path: 'rooms',
          populate: {
            path: 'messages',
            populate: { path: 'user'}
          }
        }).populate({
          path: 'rooms',
          populate: { path: 'users' }
        });

        callback(foundUser, roomId); // send result to the client

        let foundRoom = await db.Room.findById(roomId).populate({
          path: 'users',
        }).populate({
          path: 'messages',
          populate: {
            path: 'user'
          }
        });
        // broadcast to all subscribers about new user in room
        io.to(roomId).emit(ROOM_ACCESS, foundRoom);
      } else {
        let error = 'There is NO such room in DB';
        callback(null, null, error);
      }
    } catch(err) {
      let error = 'Invalid room URL';
      callback(null, null, error);
    }
  });

  socket.on(JOIN_ROOM, ({ roomId }, cb) => {
    console.log('JOIN_ROOM fired');
    if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[roomId]){
      ROOMS_ACTIVITY[roomId].usersOnline.add(socket.id);
    } else {
      ROOMS_ACTIVITY = {
        ...ROOMS_ACTIVITY,
        [roomId]: {
          streamer: null,
          usersOnline: new Set([socket.id])
        }
      }
    }
    console.log('ROOMS_ACTIVITY is: ', ROOMS_ACTIVITY);
    // broadcast to all subscribers in the room about new user online
    let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline)
    io.to(roomId).emit(JOIN_ROOM, onlineUsersArray);
  });

  socket.on(EXIT_ROOM, ({ roomId }, cb) => {
    if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[roomId]) {
      ROOMS_ACTIVITY[roomId].usersOnline.delete(socket.id);
      console.log('AFTER DELETE ROOMS_ACTIVITY is: ', ROOMS_ACTIVITY);
      // broadcast to all subscribers in the room about user has been detachet
      let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline)
      io.to(roomId).emit(EXIT_ROOM, onlineUsersArray);
    }
  });

  socket.on(UNSUBSCRIBE, ()=>{
    let rooms = Object.keys(socket.rooms);
    console.log('Rooms socket leaves: ',rooms);
    rooms.forEach(item => socket.leave(item));
  });

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected!`);
    let roomId;
    if(ROOMS_ACTIVITY) {
      for(let key in ROOMS_ACTIVITY){
        if(ROOMS_ACTIVITY[key].usersOnline.delete(socket.id)){
          roomId = key;
          // broadcast to all subscribers in the room about user has been detached
          let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline)
          io.to(roomId).emit(EXIT_ROOM, onlineUsersArray);
        }
      }
      console.log('AFTER DELETE ROOMS_ACTIVITY is: ', ROOMS_ACTIVITY);
    }
  });

  ////////////////////////// SIGNALS /////////////////////////////////////////
  socket.on(SIGNAL, (message) =>{
    switch(message.type) {
      case 'video-offer':

        console.log('Get a video offer:', message);
        // sending private messages to target Socket
        io.to(message.target).emit(SIGNAL, message);
        break;
      case 'answer':
        io.to(message.target).emit(SIGNAL, message);
        break;
      case 'new-ice-candidate':
        io.to(`${message.target}`).emit(SIGNAL, message);
        break;
      default:
        console.log('No such event in signaling server');

        // sendTo(connection, {
        //   type: 'error',
        //   message: 'Unrecognized command: ' + data.type
        // });
    }
  });

  socket.on(STREAMING, (user, activeChatId) => {
    console.log('STREAMING: ', user, activeChatId);

    // broadcast to all subscribers about streaming
    switch(!!user){
      case true:
        if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[activeChatId]){
          ROOMS_ACTIVITY[activeChatId].streamer = user;
          socket.to(activeChatId).emit(STREAMING, user);
        }
        break;
      case false:
        console.log('STREAMING closing');
        if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[activeChatId]){
          ROOMS_ACTIVITY[activeChatId].streamer = null;
          socket.to(activeChatId).emit(STREAMING, null);
        }
        break;
    }

  });
}