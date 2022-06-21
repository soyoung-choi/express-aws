const dotenv = require('dotenv')
dotenv.config()

const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const cors = require('cors')
const session = require('express-session')
const helmet = require('helmet')
const hpp = require('hpp')
const csrf = require('csurf')
const logger = require('./logger')
const redis = require('redis')
const RedisStore = require('connect-redis')(session)

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
})

const indexRouter = require('./routes/index')
const usersRouter = require('./routes/users')

const app = express()
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

if (process.env.NODE_ENV === 'production') {
  app.enable('trust proxy')
  app.use(morgan('combined'))
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(hpp())
} else {
  app.use(morgan('dev'))
}

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(csrf({ cookie: true }))
app.use(express.static(path.join(__dirname, 'public')))

const sessionOption = {
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET, // 서명에 필요한 값
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60,
    secure: false, // https일 때 적용
  },
  store: new RedisStore({ client: redisClient }),
}

if (process.env.NODE_ENV === 'production') {
  sessionOption.proxy = true
  // sessionOption.cookie.secure = true
}

app.use(session(sessionOption))

app.use('/', indexRouter)
app.use('/users', usersRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  logger.error(err)
  if (err.code !== 'EBADCSRFTOKEN') return next(err)

  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app
