import React, { Component } from 'react';
import { VERIFY_USER } from '../Events';
import { Spinner } from 'reactstrap';
import { Button } from 'reactstrap';

import '../styles/LoginForm.css';

export default class LoginForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      error: '',
      inLoad: null
    }
  }
  handleChange = (e) => {
    this.setState({name: e.target.value})
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const { socket } = this.props;
    const { name } = this.state;
    socket.emit(VERIFY_USER, name, this.setUser);
    this.setState({name:'', inLoad: true, error: ''});
  }

  setUser = ({user, error}) => {
    if(error) {
      this.setState({error, inload: false});
    } else {
      this.setState({error: '', inLoad: false});
      this.props.logIn(user);
    }
  }

  render() {
    const {name, error, inLoad } = this.state;
    if(inLoad){
      return(
        <div className='LoginForm-spinner' >
          <Spinner style={{ width: '3rem', height: '3rem' }} color='secondary'/>
        </div>
      )
    }
    return (
      <form className='LoginForm' onSubmit={this.handleSubmit}>
        <label htmlFor='name'>
          <h2>Enter your nickname </h2>
        </label>
        <input
          type='text'
          id='name'
          value={name}
          onChange={this.handleChange}
          placeholder='Enter your nickname'

        />
        <Button
          className='LoginForm-button'
          type='submit'
          color='secondary'
          size='sm'
          disabled={ name ? false : true}
        >
          LogIn
        </Button>
        { error && <div className='LoginForm-error'>{error}</div>}
      </form>
    )
  }
}