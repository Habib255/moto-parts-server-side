const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000



app.use(cors())
app.use(express.json())


app.get('/', (req, res) => {
    res.send('hello wanna buy bike parts for your garage!')
})

app.listen(port, () => {
    console.log(`speedo parts listening on port ${port}`)
})