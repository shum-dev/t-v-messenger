import React, { Component } from 'react';
import io from 'socket.io-client';
import { withRouter, Switch, Route, Redirect} from 'react-router-dom';
import { Spinner } from 'reactstrap';
import ChatContainer from './ChatContainer';
import { ROOM_ACCESS, FETCH_USER_DATA, UNSUBSCRIBE } from '../Events';

import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/ChatApp.css';

const socketUrl = 'http://192.168.1.2:3231';

let socket;

class ChatApp extends Component {
  constructor (props) {
    super(props);
    this.state = {
      user: null,
      error: '',
      // initially show loader till fetching is done
      inLoad: window.localStorage.getItem('ChatUser') ? true : false
    };
    if(!socket) { // establish connection if required
      socket = io(socketUrl);
      socket.on('connect', () => {
        let userFromLocalStorage = window.localStorage.getItem('ChatUser');
        if(userFromLocalStorage){ // when connected check localstorage...
          socket.emit(FETCH_USER_DATA, // ... fetch data if there is user in localStorage
                       userFromLocalStorage, // after .setState() set loader to false
                       (x) => this.setState(x, () => {this.setState({inLoad: false})}));
        } else {
          console.log("Nothing in localStorage!");
        }
      });
    }
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
      if(foundedRoom){ // if user already join this room render ChatContainer and
        return <ChatContainer
                  {...routeProps}
                  socket={socket}
                  user={user}
                  logOut={this.logOut}
                  logIn={this.logIn}
                  activeChat={foundedRoom} // ... set proper activeChat
                />
      }
      // request to DB for handle room access
      socket.emit(ROOM_ACCESS, roomId, user.name, this.handleRoomAccess)
      this.setState({inLoad: true});
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
    // if not error set resieved user in state the redirect to roomID
    this.setState({ user: res, inLoad: false }, () => {
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
          />}
        />
        <Route exact path='/:id' render={this.handleRoute}/>
        <Route render={() => <Redirect to='/'/>}/>
      </Switch>
    );
  }
}

export default withRouter(ChatApp);
