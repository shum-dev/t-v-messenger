import React, { Component } from 'react';
import { Button, ListGroup, ListGroupItem, Badge} from 'reactstrap';

import '../styles/SideBar.css';

export default class SideBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newRoomName: '',
      error: ''
    }
  }
  handleSubmit = (e) => {
    e.preventDefault();
    const { chats } = this.props;
    const { newRoomName } = this.state;
    if(chats.some(item => item.name === this.state.newRoomName)){
      this.setState({error: 'Name should be unique!'});
      return;
    }
    this.props.createRoom(newRoomName);
    this.setState({newRoomName: '', error: ''});
  }
  render() {
    const { newRoomName, error } = this.state;
    const { logOut, chats, user, activeChat, setActiveChat } = this.props;
    return (
      <div
        className='SideBar'
      >
        <div>
              <form className='SideBar-form' onSubmit={this.handleSubmit}>
                <input
                  type='text'
                  placeholder='Enter room name ...'
                  value={newRoomName}
                  onChange={({target}) => this.setState({newRoomName: target.value})}
                ></input>
                <Button
                  type='submit'
                  className="SideBar-button"
                  color='primary'
                  disabled={!newRoomName && true}
                >
                  Add new chat room
                </Button>
              </form>
          { error && <p className='SideBar-error'>{error}</p>}
          <ListGroup>
            { chats &&
              chats.map(chat => {
                  const subClass = (activeChat && activeChat._id === chat._id) ? 'active' : ''
                  return(
                    <ListGroupItem
                      key={chat._id}
                      active={subClass ? true : false}
                      tag="li"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveChat(chat);
                        this.setState({error: ''});
                      }}
                    >
                      {chat.name} <Badge color="secondary">{chat.users.length}</Badge>
                    </ListGroupItem>
                  )
              })
            }
          </ListGroup>
        </div>
        <div className='current-user'>
          <h5>{user.name}</h5>
          <div className='logout' onClick={() => logOut()} title='Logout'>
            <Button color="danger" size='sm'>Logout</Button>
          </div>
        </div>
      </div>
    );
  }
}