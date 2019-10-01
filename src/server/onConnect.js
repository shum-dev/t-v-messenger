const io = require('./index').io;
const db = require('./models');
const { VERIFY_USER, CREATE_NEW_ROOM, CREATE_NEW_MESSAGE,
        ADD_NEW_MESSAGE, ROOM_ACCESS, FETCH_USER_DATA, UNSUBSCRIBE,
        JOIN_ROOM, EXIT_ROOM, SIGNAL, STREAMING, STREAM_REQEST,
        CLOSE_CONNECTION } = require('../Events');

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
        // bind socket and user
        socket.userId = foundUser.id;
        // subscribe socket to existing rooms
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
        // if exist subscribe to all rooms in a list and bind socket and user ID
      if(user){
        // bind socket and user
        console.log('There is such user in DB');
        socket.userId = user.id;
        let { rooms } = user;
        // subscribe socket to existing rooms
        rooms.forEach(item => {
          console.log('Create subscription for room: ', item.id);

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
        socket.userId = user.id; // bind socket and created user ID
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

  socket.on(JOIN_ROOM, ({ roomId }) => {
    console.log('JOIN_ROOM fired: ');
    // add new online user to the room
    if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[roomId]){
      ROOMS_ACTIVITY[roomId].usersOnline.add(socket.id);
    } else { // or create new room in ACTIVITY list
      ROOMS_ACTIVITY = {
        ...ROOMS_ACTIVITY,
        [roomId]: {
          streamer: null,
          usersOnline: new Set([socket.id])
        }
      }
    }
    // broadcast to all online subscribers in the room about new user online
    // additionally send streamer too
    let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline);
    onlineUsersArray.forEach(item => {
      console.log('emit JOIN_ROOM for: ', item);
      io.to(item).emit(JOIN_ROOM, onlineUsersArray, ROOMS_ACTIVITY[roomId].streamer);
    });

    if(ROOMS_ACTIVITY[roomId].streamer) {
      console.log('There is a streamer in the room.');
      // tell the streamer to create ne connection for me
      const streamerSocket = ROOMS_ACTIVITY[roomId].streamer.socketId;
      io.to(streamerSocket).emit(STREAM_REQEST, socket.id);
    }

  });

  socket.on(EXIT_ROOM, ({ roomId }) => {
    if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[roomId]) {

      if(ROOMS_ACTIVITY[roomId].streamer)

      ROOMS_ACTIVITY[roomId].usersOnline.delete(socket.id);
      console.log('AFTER DELETE ROOMS_ACTIVITY is: ', ROOMS_ACTIVITY);
      // broadcast to all Online subscribers in the room about user has been detachet
      let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline);
      onlineUsersArray.forEach(item => {
        console.log('emit EXIT_ROOM for: ', item);
        io.to(item).emit(EXIT_ROOM, onlineUsersArray);
      });
    }
  });

  socket.on(UNSUBSCRIBE, () => {
    let rooms = Object.keys(socket.rooms);
    let roomId;
    console.log('Rooms socket leaves: ',rooms);
    // unsubscribe socket from all rooms but current socket
    rooms.forEach((item, i) => {
      if( item === socket.id) return;
      socket.leave(item)
    })
    if(ROOMS_ACTIVITY) {
      for(let key in ROOMS_ACTIVITY){
        if(ROOMS_ACTIVITY[key].usersOnline.delete(socket.id)) {
          roomId = key;
          let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline);
          // broadcast to all online subscribers in the room about user has stoped streaming
          if(ROOMS_ACTIVITY[roomId].streamer && ROOMS_ACTIVITY[roomId].streamer._id === socket.userId ){
            ROOMS_ACTIVITY[roomId].streamer = null;
            onlineUsersArray.forEach(item => {
              console.log('emit "disconnect" for: ', item, ' and close STREAM');
              io.to(item).emit(STREAMING, null);
            });
          }
          // broadcast to all online subscribers in the room about user has been detached
          onlineUsersArray.forEach(item => {
            console.log('emit "disconnect" for: ', item);
            io.to(item).emit(EXIT_ROOM, onlineUsersArray);
          });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected!`);
    let roomId;
    if(ROOMS_ACTIVITY) {
      for(let key in ROOMS_ACTIVITY){
        if(ROOMS_ACTIVITY[key].usersOnline.delete(socket.id)) {
          roomId = key;
          let onlineUsersArray = Array.from(ROOMS_ACTIVITY[roomId].usersOnline);
          // broadcast to all online subscribers in the room about user has stoped streaming
          if(ROOMS_ACTIVITY[roomId].streamer && ROOMS_ACTIVITY[roomId].streamer._id === socket.userId ){
            ROOMS_ACTIVITY[roomId].streamer = null;
            onlineUsersArray.forEach(item => {
              console.log('emit "disconnect" for: ', item, ' and close STREAM');
              io.to(item).emit(STREAMING, null);
            });
          }
          // broadcast to all online subscribers in the room about user has been detached
          onlineUsersArray.forEach(item => {
            console.log('emit "disconnect" for: ', item);
            io.to(item).emit(EXIT_ROOM, onlineUsersArray);
          });
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
    }
  });

  socket.on(STREAMING, (streamer, activeChatId) => {
    // broadcast to all online subscribers about stream
    if(!!streamer){
      if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[activeChatId]){
        let onlineUsersArray = Array.from(ROOMS_ACTIVITY[activeChatId].usersOnline);
        ROOMS_ACTIVITY[activeChatId].streamer = {...streamer, socketId: socket.id};
        onlineUsersArray.forEach(item => {
          console.log('emit STREAM for: ', item);
          io.to(item).emit(STREAMING, streamer);
        });
      }
    } else {
      // broadcast to all online subscribers about stream is closing
      console.log('STREAM is closing');
      if(ROOMS_ACTIVITY && ROOMS_ACTIVITY[activeChatId]){
        let onlineUsersArray = Array.from(ROOMS_ACTIVITY[activeChatId].usersOnline);
        ROOMS_ACTIVITY[activeChatId].streamer = null; // set streamer to null
        onlineUsersArray.forEach(item => {
          console.log('emit STREAM for: ', item);
          io.to(item).emit(STREAMING, null);
        });
      }
    }
  });

  socket.on(CLOSE_CONNECTION, (targetSocket) => {
    console.log('Server recieve CLOSE_CONNECTION: ', targetSocket);
    io.to(targetSocket).emit(CLOSE_CONNECTION, socket.id);
  });
}