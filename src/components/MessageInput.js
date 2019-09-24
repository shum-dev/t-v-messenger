import React, { Component } from 'react';
import { Button, Form, Input} from 'reactstrap';

import '../styles/MessgeInput.css';

export default class MessageInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      message: '',
    };
  }
  handleSubmit = (e) => {
    e.preventDefault();
    this.props.sendMessage(this.state.message);
    this.setState({message: ''});
  }
  render() {
    const { message } = this.state;
    return (
        <Form inline
          onSubmit={ this.handleSubmit }
          className='MessageInput'
        >
            <Input
              className='MessageInput-input'
              name='message'
              type = "text"
              value = { message }
              autoComplete = 'off'
              placeholder = "Write a message"
              onChange = {({target})=> this.setState({message:target.value})}
            />
            <Button
              className='MessageInput-button'
              disabled = { message.length < 1 }
              type = "submit"
            >
              Send
            </Button>
            <Button
              className='MessageInput-button-broadcast'
              // disabled = { message.length < 1 }
              color = 'primary'

            >
              Broadcast
            </Button>
        </Form>

    )
  }
}