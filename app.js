var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { default: axios } = require('axios');
const jwt = require('jsonwebtoken')

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const CLIENT_ID = '<<Your client ID>>'
const CLIENT_SECRET = '<<Your client secret>>'

const users = [
  {
    username: 'alice',
    password: 'alice-password',
    sessions: [],
    accessToken: null
  },
  {
    username: 'bob',
    password: 'bob-password',
    sessions: [],
    accessToken: null
  }
]

app.get('/login', (req, res) => res.render('login'))
app.post('/login', (req, res) => {
  const user = users.find(user => user.username === req.body.username)

  if (user && user.password === req.body.password) {
    const sessionId = Math.random().toString(36).substring(7)
    user.sessions.push(sessionId)
    res.cookie('session-cookie', sessionId, { maxAge: 3600 * 1000 })
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
})

app.get('/handle-redirect', async (req, res) => {
  const sessionId = req.cookies['session-cookie']
  const user = users.find(u => u.sessions.find(s => s === sessionId))

  const response = await axios.post(`https://ugm-auth.vercel.app/api/auth/get-access-token`, {
    authToken: req.query.authToken,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  })

  const accessToken = response.data.accessToken

  if (user) {
    user.accessToken = accessToken
    res.render('handle-auth-token', { status: 'successful' })
  } else {
    res.render('handle-auth-token', { status: 'failed' })
  }
})

app.get('/', async (req, res) => {
  const sessionId = req.cookies['session-cookie']
  const user = users.find(u => u.sessions.find(s => s === sessionId))

  if (user) {
    let ugmIdentity = null
    if (user.accessToken) {
      const decodedAccessToken = jwt.decode(user.accessToken)
  
      const response = await axios.get(`https://ugm-auth.vercel.app/api/identity/${decodedAccessToken.student.id}`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      })
  
      ugmIdentity = response.data
    }

    res.render('profile', {
      clientId: CLIENT_ID,
      username: user.username, 
      ugmIdentity: ugmIdentity ? JSON.stringify(ugmIdentity, null, 2) : 'Account not yet linked.'
    })
  } else {
    res.redirect('/login')
  }
})

app.get('/logout', (req, res) => {
  res.clearCookie('session-cookie')
  res.redirect('/login')
})

module.exports = app;
