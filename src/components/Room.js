import React, { Component } from 'react';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';
import { JOIN_ROOM, EXIT_ROOM } from '../Events';

import '../styles/Room.css';

class Room extends Component {
  constructor(props) {
    super(props);
    this.state = {
      usersOnline: [],
      streamer: null
    }
  }

  componentDidMount(){
    const { socket } = this.props;

    socket.on(JOIN_ROOM, (usersOnline) => {
      console.log('JOIN_ROOM fired. Data from the server: ', usersOnline);
      this.setState({usersOnline});
    });

    socket.on(EXIT_ROOM, (usersOnline) => {
      console.log('EXIT_ROOM fired. Data from the server: ', usersOnline);
      this.setState({usersOnline});
    });
  }

  render() {
    const {activeChat, user, createMessage} = this.props;
    return (
      <div className='Room'>
        {
            <div className='Room-chat'>
              <ChatHeading activeChat={activeChat} user={user.name} />
              <Messages
                messages={activeChat.messages}
                user={user}
              />
              <MessageInput
                sendMessage={createMessage}
              />
            </div>
        }
      </div>
    )
  }
}

export default Room;

