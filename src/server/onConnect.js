const io = require('./index').io;
const db = require('./models');
const { VERIFY_USER, CREATE_NEW_ROOM, CREATE_NEW_MESSAGE,
        ADD_NEW_MESSAGE, ROOM_ACCESS, FETCH_USER_DATA} = require('../Events');

// Create generic room for all users
(async function initGenericRoom(){
  let genericRoom;
  try {
    genericRoom = await db.Room.findOne({ name: 'Generic' });
    if(!genericRoom){
      genericRoom = await db.Room.create({name: 'Generic'});
    }
  } catch(ignore){}
}())

module.exports = function(socket){
  console.log(`Socket ID: ${socket.id} connected!`);

  // initially fetch user data from DB
  socket.on(FETCH_USER_DATA, async (user, callback) => {
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
        callback({user: foundUser});
      }
        callback({user: null});
    } catch(err) {
      console.log('Something gous wrong in FETCH_USER_DATA ', err);
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
        // an user don't enjoi it yet
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

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected!`);
  });
}