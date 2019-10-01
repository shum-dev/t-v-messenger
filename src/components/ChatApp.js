import React, { Component } from 'react';
import { socket, createConnection} from '../socketIO';
import { withRouter, Switch, Route, Redirect} from 'react-router-dom';
import { Spinner } from 'reactstrap';
import ChatContainer from './ChatContainer';
import { ROOM_ACCESS, FETCH_USER_DATA, UNSUBSCRIBE, JOIN_ROOM,
        CREATE_NEW_ROOM, CREATE_NEW_MESSAGE, ADD_NEW_MESSAGE,
        EXIT_ROOM } from '../Events';

import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/ChatApp.css';

class ChatApp extends Component {
  constructor (props) {
    super(props);
    this.state = {
      user: null,
      error: '',
      // initially show loader till fetching is done
      inLoad: window.localStorage.getItem('ChatUser') ? true : false,
      activeChat: null,
    };
    if(!socket) { // establish connection if required
      createConnection();
      socket.on('connect', () => {
        let userFromLocalStorage = window.localStorage.getItem('ChatUser');
        if(userFromLocalStorage){ // when connected check localstorage...
          socket.emit(FETCH_USER_DATA, // ... fetch data if there is user in localStorage + activeChat
                       userFromLocalStorage,
                       this.props.location.pathname.slice(1),
                       (x) => this.setState(x,
                        () => {this.setState({inLoad: false})})); // after .setState() set loader to false
        } else {
          console.log("Nothing in localStorage!");
        }
      });
    }
  }
  componentDidMount(){
    socket.on(ADD_NEW_MESSAGE, updatedRoom => {
      this.updateCurrentChatsInState(updatedRoom);
    });

    socket.on(ROOM_ACCESS, (updatedRoom) => {
      this.updateCurrentChatsInState(updatedRoom);
    });
  }
   // update current state with recieved data from server
  updateCurrentChatsInState = (updatedRoom) => {
  const { user } = this.state;
  let newRooms = user.rooms.map( chat => {
    if(chat._id === updatedRoom._id){
      return updatedRoom;
    }
    return chat;
  });
  let updatedUser = {...user, rooms: newRooms};
  this.logIn(updatedUser); // call .logIn() just for sync purpose
}
  //create room on server-side
  createRoom = (roomName) => {
    const { user } = this.state;
    socket.emit(CREATE_NEW_ROOM, roomName, user.name, this.addRoom);
  }
  //add room to the state
  addRoom = (updatedUser) => {
    // this.props.logIn(updatedUser); // call .logIn() just for sync LocalStorage
    this.setState({user: updatedUser});
    // this.setState({chats: updatedUser.rooms });
  }
  setActiveChat = (activeChat) => {
    this.setState({activeChat});
    let currentURL = this.props.location.pathname.slice(1);
    socket.emit(EXIT_ROOM, { roomId: currentURL });
    this.props.history.push(`/${activeChat._id}`);
  }
  // create message on server-side
  createMessage = (message) => {
    socket.emit(CREATE_NEW_MESSAGE, {
      roomId: this.state.activeChat._id,
      message,
      userId: this.state.user._id
    });
  }
  logIn = (user) => {
    this.setState({user});
    window.localStorage.setItem('ChatUser', user.name);
  }
  logOut = () => {
    socket.emit(UNSUBSCRIBE, this.state.user.name);
    window.localStorage.removeItem('ChatUser');
    this.setState({user: null});
  }
  // when user tries to access the roomID
  handleRoute = (routeProps) => {
    const roomId = routeProps.match.params.id;
    const { user } = this.state;
    if(user){
      const foundedRoom = user.rooms.filter(item => item._id === roomId)[0];
      if(foundedRoom){ // if user already join the room, add this user to usersOnline [] and broadcast to all
        socket.emit(JOIN_ROOM, { roomId });
        return (
          <ChatContainer
            {...routeProps}
            socket={socket}
            user={user}
            logOut={this.logOut}
            logIn={this.logIn}
            activeChat={foundedRoom}
            setActiveChat={this.setActiveChat}
            createMessage={this.createMessage}
            createRoom={this.createRoom}
          />
        )
      }
      // request to DB for handle room access
      socket.emit(ROOM_ACCESS, roomId, user.name, this.handleRoomAccess);
      // this.setState({inLoad: true});
    } else {
      return <Redirect to='/'/>
    }
  }
  // ROOM_ACCESS callback
  handleRoomAccess = (res, roomId, error) => {
    if(error) { // show error for 2 sec then redirect to root
      return this.setState({error: error, inLoad: false}, () => {
        setTimeout(()=>{
          this.props.history.push('/');
          this.setState({error: ''});
        }, 2000);
      });
    }
    // if not error set recieved user in state then redirect to roomID
    this.setState({
      user: res,
      inLoad: false,
      activeChat: res.rooms.slice(-1)[0] }, // set last added room as an activeChat
      () => {
      this.props.history.push(`/${roomId}`);
    });
  }
  render() {
    const { user, error, inLoad } = this.state;
    if(error){
      return (
        <h1 className='Layout-error'>{error}</h1>
      )
    }
    if(inLoad){
      return(
        <div className='Layout-spinner' >
          <Spinner style={{ width: '3rem', height: '3rem' }} color='secondary'/>
        </div>
      )
    }
    return (
      <Switch>
        <Route exact path='/'
          render={(routeProps) =>
          <ChatContainer
            {...routeProps}
            socket={socket}
            user={user}
            logOut={this.logOut}
            logIn={this.logIn}
            setActiveChat={this.setActiveChat}
            createMessage={this.createMessage}
            createRoom={this.createRoom}
          />}
        />
        <Route exact path='/:id' render={this.handleRoute}/>
        <Route render={() => <Redirect to='/'/>}/>
      </Switch>
    );
  }
}

export default withRouter(ChatApp);
