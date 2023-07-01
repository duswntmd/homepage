const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const dbconfig = require('./config/dbconfig.json');
const app = express();

const db = mysql.createConnection({
  connectionLimit: 10,
  host: dbconfig.host,
  user: dbconfig.user,
  password: dbconfig.password,
  port: dbconfig.port,
  database: dbconfig.database,
  debug: false,
});

db.connect((error) => {
  if (error) {
    console.error('MySQL connection error:', error);
    return;
  }
  console.log('Connected to MySQL server');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('views'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'views/uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  db.query('SELECT * FROM worldcup', (error, results) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    const posts = results;
    let html = '<h1>이상향 월드컵</h1>';
    html += '<ul>';
    for (const post of posts) {
      html += `<li><a href="/post?id=${post.id}">${post.title}</a></li>`;
    }
    html += '</ul>';
    html += fs.readFileSync(path.join(__dirname, 'views', 'search.html'), 'utf-8');

    res.send(html);
  });
});

app.get('/create', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'views', 'create.html'), 'utf-8');
  res.send(html);
});


app.post('/create', upload.array('image1', 4), (req, res) => {
  const { title, content } = req.body;
  const imageFiles = req.files;

  if (!title || !content || !imageFiles || imageFiles.length < 4) {
    res.status(400).send('Invalid request');
    return;
  }

  const post = {
    title,
    content,
    image_url1: imageFiles[0].filename,
    image_url2: imageFiles[1].filename,
    image_url3: imageFiles[2].filename,
    image_url4: imageFiles[3].filename
  };

  db.query('INSERT INTO worldcup SET ?', post, (error, result) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log('New post created:', result.insertId);
    res.redirect('/');
  });
});

// 게시물 검색
app.get('/search', (req, res) => {
  const query = req.query.query;

  db.query('SELECT * FROM worldcup WHERE title LIKE ?', [`%${query}%`], (error, results) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    const posts = results;
    let html = '<h1>검색 결과</h1>';
    html += '<ul>';
    for (const post of posts) {
      html += `<li><a href="/post?id=${post.id}">${post.title}</a></li>`;
    }
    html += '</ul>';

    res.send(html);
  });
});

// 특정 게시물 조회
app.get('/post', (req, res) => {
  const postId = parseInt(req.query.id, 10);

  db.query('SELECT * FROM worldcup WHERE id = ?', [postId], (error, results) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Post not found');
      return;
    }
    
    const post = results[0];
    const imageUrls = [post.image_url1, post.image_url2, post.image_url3, post.image_url4];

    // 랜덤으로 2개의 이미지 선택
    const randomIndexes = getRandomIndexes(2, imageUrls.length);
    const selectedImages = randomIndexes.map(index => imageUrls[index]);
    const html = fs.readFileSync(path.join(__dirname, 'views', 'post.html'), 'utf-8');
    res.send(html.replace(/<%= post.title %>/g, post.title)
      .replace(/<%= post.content %>/g, post.content)
      .replace(/<%= post.id %>/g, post.id)
      .replace(/<%= post.image_url1 %>/g, selectedImages[0])
      .replace(/<%= post.image_url2 %>/g, selectedImages[1]));
      

      
  });
});


// 랜덤하고 고유한 인덱스 배열을 생성하는 함수
function getRandomIndexes(count, length) {
  const indexes = [];

  while (indexes.length < count) {
    const index = Math.floor(Math.random() * length);
    if (!indexes.includes(index)) {
      indexes.push(index);
    }
  }
  return indexes;
}



// 게시물 수정 폼
app.get('/edit', (req, res) => {
  const postId = parseInt(req.query.id, 10);

  db.query('SELECT * FROM worldcup WHERE id = ?', [postId], (error, results) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Post not found');
      return;
    }

    const post = results[0];
    const html = fs.readFileSync(path.join(__dirname, 'views', 'edit.html'), 'utf-8');
    res.send(html.replace(/<%= post.title %>/g, post.title)
      .replace(/<%= post.content %>/g, post.content)
      .replace(/<%= post.id %>/g, post.id)
      .replace(/<%= post.image_url1 %>/g, post.image_url1)
      .replace(/<%= post.image_url2 %>/g, post.image_url2));
  });
});

// 게시물 수정
app.post('/update', upload.single('image'), (req, res) => {
  const { id, title, content } = req.body;
  const imageFile = req.file;

  if (!id || !title || !content ) {
    res.status(400).send('Invalid request');
    return;
  }

  const post = {
    title,
    content
  };

  if (imageFile) {
    post.image_url = imageFile.filename;
  }

  db.query('UPDATE worldcup SET ? WHERE id = ?', [post, id], (error, result) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log('Post updated:', id);

    // 게시물 수정 후 리다이렉트
    res.redirect(`/post?id=${id}`);
  });
});

// 게시물 삭제 폼
app.get('/delete', (req, res) => {
  const postId = parseInt(req.query.id, 10);

  db.query('SELECT * FROM worldcup WHERE id = ?', [postId], (error, results) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Post not found');
      return;
    }

    const post = results[0];
    const html = fs.readFileSync(path.join(__dirname, 'views', 'delete.html'), 'utf-8');
    res.send(html.replace(/<%= post.id %>/g, post.id));
  });
});

// 게시물 삭제
app.post('/delete', (req, res) => {
  const postId = parseInt(req.body.id, 10);

  db.query('DELETE FROM worldcup WHERE id = ?', [postId], (error, result) => {
    if (error) {
      console.error('MySQL query error:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log('Post deleted:', postId);

    // 게시물 삭제 후 리다이렉트
    res.redirect('/');
  });
});

app.listen(3001, () => {
  console.log('Server started on port 3001');
});
