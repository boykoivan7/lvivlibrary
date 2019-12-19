const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
var path = require('path');
var firebase = require("firebase");;
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser')
var fs = require('fs');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: false
}))
// parse application/json
app.use(bodyParser.json())
app.use(fileUpload());

app.use(cookieParser());
app.use(session({
  key: 'user_sid',
  secret: 'somerandonstuffs',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 3600000 * 24 //day
  }
}));

app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');
  }
  next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect('/dashboard');
  } else {
    next();
  }
};

// route for user Login
app.route('/login')
  .get(sessionChecker, (req, res) => {
    if (req.session.error != null) {
      res.render("login", {
        error: req.session.error
      });
      delete req.session.error;
    } else {
      res.render("login");
    }


  })
  .post((req, res) => {
    var email = req.body.email,
      password = req.body.password;
    // firebase.database().ref("users").orderByChild("role").equalTo("admin").once('value')
    // .then(function(dataSnapshot) {
    //     res.render("admin/users", {data: dataSnapshot.val()});
    // });
    // User.findOne({ where: { username: username } }).then(function (user) {
    //     if (!user) {
    //         res.redirect('/login');
    //     } else if (!user.validPassword(password)) {
    //         res.redirect('/login');
    //     } else {
    //         req.session.user = user.dataValues;
    //         res.redirect('/dashboard');
    //     }
    // });
    firebase.database().ref("users").orderByChild("email").equalTo(email).once('value')
      .then(function (dataSnapshot) {
        if (dataSnapshot.val() === null) {
          req.session.error = "Немає користувача з таким email";
          res.redirect("/login");
        } else {
          var user;
          for (var key in dataSnapshot.val()) {
            user = dataSnapshot.val()[key];
          }
          if (user.password === password) {
            req.session.user = user.id;
            req.session.role = user.role;
            res.redirect('/dashboard');
          } else {
            req.session.error = "Неправильний пароль";
            res.redirect("/login");
          }

        }
        //console.log(dataSnapshot.val());
        // res.render("admin/users", {data: dataSnapshot.val()});
      });
  });

// route for user logout
app.get('/logout', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid');
    res.redirect('/');
  } else {
    res.redirect('/login');
  }
});

app.get('/', sessionChecker, (req, res) => {
  res.redirect('/login');
});

var config = {
  apiKey: "AIzaSyCiH1gZKVwmNwhtvedOM54efSL3r3PTndM",
  authDomain: "lviv-library.firebaseapp.com",
  databaseURL: "https://lviv-library.firebaseio.com",
  projectId: "lviv-library",
  storageBucket: "",
  messagingSenderId: "1004487165567"
};

firebase.initializeApp(config);

app.set("view engine", "ejs");
// app.set('views', path.join(__dirname, '/ejs'));

app.use(express.static(path.join(__dirname, '/public')));

var user = true;
app.get('/dashboard', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var users = dataSnapshot.val().users;
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;

          var adminCount = 0;
          var biblioCount = 0;
          var readerCount = 0;
          for (var key in users) {
            if (users[key].role === "admin") {
              adminCount++;
            } else if (users[key].role === "biblio") {
              biblioCount++;
            } else if (users[key].role === "reader") {
              readerCount++;
            }
          }

          var bookCount = 0;
          for (var key in books) {
            bookCount += +books[key].count;
          }

          var authorCount = Object.keys(authors).length;
          var sectionCount = Object.keys(sections).length;

          var orderCountNow = 0;
          var orderCountBorg = 0;
          for (var key in orders) {
            if (orders[key].date_ret === "-") {
              var date = orders[key].date_giv.split("-");
              var yyyy = +date[0];
              var mm = +date[1];
              var dd = +date[2];
              otherDate = new Date(yyyy, mm - 1, dd);
              nowDate = new Date();
              delta = nowDate.getTime() - otherDate.getTime();
              var dayCount = Math.floor(delta / 1000 / 60 / 60 / 24);
              if (dayCount > 30) {
                orderCountBorg++;
              }
              orderCountNow++;
            }
          }
          var topBooks = [];
          for (var key in books) {
            var bookItem = {};
            bookItem.id = books[key].id;
            bookItem.logo = books[key].logo;
            bookItem.countOrder = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === bookItem.id) {
                bookItem.countOrder++;
              }
            }
            topBooks.push(bookItem);
          }

          topBooks.sort(orderByCountOrder);
          var top5Books = [];
          for (var i = 0; i < 5; i++) {
            if (i === topBooks.length) break;
            top5Books.push(topBooks[i])
          }


          var data = {
            adminCount: adminCount,
            biblioCount: biblioCount,
            readerCount: readerCount,
            bookCount: bookCount,
            authorCount: authorCount,
            sectionCount: sectionCount,
            orderCountNow: orderCountNow,
            orderCountBorg: orderCountBorg,
            top5Books: top5Books
          }
          res.render(`${req.session.role}/home`, {
            data: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;

          var dataBooks = [];
          for (var key in books) {
            var dataItem = {};
            dataItem.id = books[key].id;
            dataItem.name = books[key].name;
            dataItem.author_id = books[key].author_id;
            dataItem.author_first_name = authors[dataItem.author_id].first_name;
            dataItem.author_last_name = authors[dataItem.author_id].last_name;
            dataItem.section_id = books[key].section_id;
            dataItem.section_name = sections[dataItem.section_id].name;
            dataItem.year = books[key].year;
            dataItem.logo = books[key].logo;
            dataItem.countOrder = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === dataItem.id) {
                dataItem.countOrder++;
              }
            }
            dataItem.isFavourite = false;
            for (var key3 in favourites) {
              if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                dataItem.isFavourite = true;
              }
            }
            dataBooks.push(dataItem);
          }
          var topBooks = dataBooks.slice();
          topBooks.sort(orderByCountOrder);

          var top10Books = [];
          for (var i = 0; i < 10; i++) {
            if (i === topBooks.length) break;
            top10Books.push(topBooks[i])
          }

          var newBooks = dataBooks.slice().reverse();
          var new10Books = [];
          for (var i = 0; i < 10; i++) {
            if (i === newBooks.length) break;
            new10Books.push(newBooks[i])
          }

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            top10Books: top10Books,
            new10Books: new10Books,
            sections: sectionsList
          }

          res.render("reader/home", {
            data: data
          });
        });
    }

  } else {
    res.redirect('/login');
  }
});

app.get('/account', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    firebase.database().ref("users/" + req.session.user).once('value')
      .then(function (dataSnapshot) {
        res.render(`${req.session.role}/account`, {
          data: dataSnapshot.val()
        });
      });
  } else {
    res.redirect('/login');
  }
});


app.route('/account/edit')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      firebase.database().ref("users/" + req.session.user).once('value')
        .then(function (dataSnapshot) {
          res.render(`${req.session.role}/account-edit`, {
            data: dataSnapshot.val()
          });
        });
    } else {
      res.redirect('/login');
    }


  })
  .post((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      firebase.database().ref("users/" + req.session.user).once('value')
        .then(function (dataSnapshot) {
          var user = dataSnapshot.val();
          var data = {
            id: user.id,
            last_name: req.body.last_name,
            first_name: req.body.first_name,
            father_name: req.body.father_name,
            email: req.body.email,
            password: user.password,
            phone_number: req.body.phone_number,
            date_birth: req.body.date_birth,
            city: req.body.city,
            address: req.body.address,
            date_reg: user.date_reg,
            role: user.role
          }
          var updates = {};
          updates['/users/' + user.id] = data;
          firebase.database().ref().update(updates);
          res.redirect('/account');
        });
    } else {
      res.redirect('/login');
    }

  });


app.get('/account/edit', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    firebase.database().ref("users/" + req.session.user).once('value')
      .then(function (dataSnapshot) {
        res.render("account", {
          data: dataSnapshot.val()
        });
      });
  } else {
    res.redirect('/login');
  }
});

app.get('/users', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin") {
      firebase.database().ref("users").once('value')
        .then(function (dataSnapshot) {
          var array = []
          for (var key in dataSnapshot.val()) {
            array.push(dataSnapshot.val()[key]);
          }
          array.sort(orderByLastName);
          res.render("admin/users", {
            data: array
          });
        });
    } else if (req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var users = dataSnapshot.val().users;
          var orders = dataSnapshot.val().orders;
          var data = [];
          for (var key in users) {
            if (users[key].role === "reader") {
              var dataItem = {};
              dataItem.id = users[key].id;
              dataItem.first_name = users[key].first_name;
              dataItem.last_name = users[key].last_name;
              dataItem.father_name = users[key].father_name;
              dataItem.date_birth = users[key].date_birth;
              dataItem.countOrder = 0;
              dataItem.countOrderNow = 0;
              dataItem.countOrderBorg = 0;

              for (var key2 in orders) {
                if (orders[key2].user_id === dataItem.id) {
                  dataItem.countOrder++;
                  if (orders[key2].date_ret === "-") {
                    var date = orders[key2].date_giv.split("-");
                    var yyyy = +date[0];
                    var mm = +date[1];
                    var dd = +date[2];
                    otherDate = new Date(yyyy, mm - 1, dd);
                    nowDate = new Date();
                    delta = nowDate.getTime() - otherDate.getTime();
                    var dayCount = Math.floor(delta / 1000 / 60 / 60 / 24);
                    if (dayCount > 30) {
                      dataItem.countOrderBorg++;
                    }
                    dataItem.countOrderNow++;
                  }
                }

              }
              data.push(dataItem)
            }
          }
          data.sort(orderByLastName);
          res.render("biblio/users", {
            data: data
          });
        });
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});

app.route('/users/add')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "admin" || req.session.role === "biblio") {
        res.render(`${req.session.role}/add-user`);
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {

    var uid = firebase.database().ref().child('users').push().key;
    if (typeof req.body.role == "undefined") {
      var role = "reader";
    } else {
      var role = req.body.role;

    }
    var data = {
      id: uid,
      last_name: req.body.last_name,
      first_name: req.body.first_name,
      father_name: req.body.father_name,
      email: req.body.email,
      password: req.body.date_birth, //пароль дата народження
      phone_number: req.body.phone_number,
      date_birth: req.body.date_birth,
      city: req.body.city,
      address: req.body.address,
      date_reg: getDate(),
      role: role
    }

    var updates = {};
    updates['/users/' + uid] = data;
    firebase.database().ref().update(updates);

    res.redirect('/users');
  });
//info
app.get('/users/:id', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().child('/users/' + req.params.id).once('value')
        .then(function (dataSnapshot) {
          res.render(`${req.session.role}/user-info`, {
            data: dataSnapshot.val()
          });
        });
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});

//delete user
app.get('/users/:id/delete', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().child('/users/' + req.params.id).remove();
      res.redirect("/users");
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});
//edit
app.route('/users/:id/edit')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "admin" || req.session.role === "biblio") {
        firebase.database().ref().child('/users/' + req.params.id).once('value')
          .then(function (dataSnapshot) {
            res.render(`${req.session.role}/edit-user`, {
              data: dataSnapshot.val()
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (typeof req.body.role == "undefined") {
        var role = "reader";
      } else {
        var role = req.body.role;
      }
      firebase.database().ref("users/" + req.params.id).once('value')
        .then(function (dataSnapshot) {
          var user = dataSnapshot.val();
          var data = {
            id: user.id,
            last_name: req.body.last_name,
            first_name: req.body.first_name,
            father_name: req.body.father_name,
            email: req.body.email,
            password: user.password,
            phone_number: req.body.phone_number,
            date_birth: req.body.date_birth,
            city: req.body.city,
            address: req.body.address,
            date_reg: user.date_reg,
            role: role
          }
          var updates = {};
          updates[`/users/${user.id}`] = data;
          firebase.database().ref().update(updates);
          res.redirect('/users');
        });
    } else {
      res.redirect('/login');
    }
  });


app.get('/books', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var sections = dataSnapshot.val().sections;
          var books = dataSnapshot.val().books;
          var users = dataSnapshot.val().users;
          var orders = dataSnapshot.val().orders;
          var authors = dataSnapshot.val().authors;
          var favourites = dataSnapshot.val().favourites;
          var data = [];

          for (var key in books) {
            var dataItem = {};
            dataItem.id = books[key].id;
            dataItem.name = books[key].name;
            dataItem.author_id = books[key].author_id;
            dataItem.author_first_name = authors[dataItem.author_id].first_name;
            dataItem.author_last_name = authors[dataItem.author_id].last_name;
            dataItem.section_id = books[key].section_id;
            dataItem.section_name = sections[dataItem.section_id].name;
            dataItem.year = books[key].year;
            dataItem.logo = books[key].logo;
            dataItem.count = books[key].count;
            dataItem.count_giv = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === dataItem.id) {
                dataItem.count_giv++;
              }
            }
            dataItem.count_av = dataItem.count - dataItem.count_giv;
            dataItem.count_fav = 0;
            for (var key3 in favourites) {
              if (favourites[key3].book_id === dataItem.id) {
                dataItem.count_fav++;
              }
            }
            data.push(dataItem);
          }
          data.sort(orderByName);
          res.render(`${req.session.role}/books`, {
            data: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;

          var dataBooks = [];
          for (var key in books) {
            var dataItem = {};
            dataItem.id = books[key].id;
            dataItem.name = books[key].name;
            dataItem.author_id = books[key].author_id;
            dataItem.author_first_name = authors[dataItem.author_id].first_name;
            dataItem.author_last_name = authors[dataItem.author_id].last_name;
            dataItem.section_id = books[key].section_id;
            dataItem.section_name = sections[dataItem.section_id].name;
            dataItem.year = books[key].year;
            dataItem.logo = books[key].logo;
            dataItem.countOrder = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === dataItem.id) {
                dataItem.countOrder++;
              }
            }
            dataItem.isFavourite = false;
            for (var key3 in favourites) {
              if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                dataItem.isFavourite = true;
              }
            }
            dataBooks.push(dataItem);
          }
          dataBooks.sort(orderByName);

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            dataBooks: dataBooks,
            sections: sectionsList
          }

          res.render("reader/books", {
            data: data
          });
        });
    }
  } else {
    res.redirect('/login');
  }
});



app.route('/books/add')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().once('value')
          .then(function (dataSnapshot) {
            var authors = dataSnapshot.val().authors;
            var sections = dataSnapshot.val().sections;
            res.render("biblio/add-book", {
              authors: authors,
              sections: sections
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    var uid = firebase.database().ref().child('books').push().key;
    if (req.files === null) {
      var path = '/storage/images/no-image.jpg';
    } else {
      if (req.files.logo != null) {
        var file = req.files.logo,
          name = uid + "." + file.name.split(".").pop(),
          type = file.mimetype;
        var path = '/storage/images/books/' + name;
        var uploadpath = __dirname + "/public" + path;
        file.mv(uploadpath, function (err) {
          if (err) {
            firebase.database().ref().child('/books/' + uid).remove();
            res.redirect('/books');
          }
        });
      } else {
        var path = '/storage/images/no-image.jpg';
      };
    }

    var data = {
      id: uid,
      name: req.body.name,
      author_id: req.body.author_id,
      section_id: req.body.section_id,
      year: req.body.year,
      count: req.body.count,
      logo: path,
      desc: req.body.desc
    }

    var updates = {};
    updates['/books/' + uid] = data;
    firebase.database().ref().update(updates);

    res.redirect('/books');
  });

app.get('/books/:id', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var sections = dataSnapshot.val().sections;
          var book = dataSnapshot.val().books[req.params.id];
          var users = dataSnapshot.val().users;
          var orders = dataSnapshot.val().orders;
          var authors = dataSnapshot.val().authors;
          var favourites = dataSnapshot.val().favourites;
          var data = {};

          data.id = book.id;
          data.name = book.name;
          data.author_id = book.author_id;
          data.author_first_name = authors[data.author_id].first_name;
          data.author_last_name = authors[data.author_id].last_name;
          data.section_id = book.section_id;
          data.section_name = sections[data.section_id].name;
          data.year = book.year;
          data.logo = book.logo;
          data.count = book.count;
          data.count_giv = 0;
          for (var key2 in orders) {
            if (orders[key2].book_id === data.id) {
              data.count_giv++;
            }
          }
          data.count_av = data.count - data.count_giv;
          data.count_fav = 0;
          for (var key3 in favourites) {
            if (favourites[key3].book_id === data.id) {
              data.count_fav++;
            }
          }
          data.desc = book.desc;
          res.render(`${req.session.role}/book-info`, {
            data: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var sections = dataSnapshot.val().sections;
          var book = dataSnapshot.val().books[req.params.id];
          var users = dataSnapshot.val().users;
          var orders = dataSnapshot.val().orders;
          var authors = dataSnapshot.val().authors;
          var favourites = dataSnapshot.val().favourites;
          var data = {};

          data.id = book.id;
          data.name = book.name;
          data.author_id = book.author_id;
          data.author_first_name = authors[data.author_id].first_name;
          data.author_last_name = authors[data.author_id].last_name;
          data.section_id = book.section_id;
          data.section_name = sections[data.section_id].name;
          data.year = book.year;
          data.logo = book.logo;
          data.count = book.count;
          data.count_giv = 0;
          for (var key2 in orders) {
            if (orders[key2].book_id === data.id) {
              data.count_giv++;
            }
          }
          data.count_av = data.count - data.count_giv;
          data.count_fav = 0;
          for (var key3 in favourites) {
            if (favourites[key3].book_id === data.id) {
              data.count_fav++;
            }
          }
          data.desc = book.desc;

          data.isFavourite = false;
          for (var key3 in favourites) {
            if (favourites[key3].book_id === data.id && favourites[key3].user_id === req.session.user) {
              data.isFavourite = true;
            }
          }

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);

          mydata = {
            dataBook: data,
            sections: sectionsList
          }

          res.render("reader/book-info", {
            data: mydata
          });
        });
    }
  } else {
    res.redirect('/login');
  }
});

app.route('/books/:id/edit')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().once('value')
          .then(function (dataSnapshot) {
            var book = dataSnapshot.val().books[req.params.id];
            var authors = dataSnapshot.val().authors;
            var sections = dataSnapshot.val().sections;

            res.render("biblio/edit-book", {
              book: book,
              authors: authors,
              sections: sections
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    firebase.database().ref("books/" + req.params.id).once('value')
      .then(function (dataSnapshot) {
        if (req.files === null) {
          var path = dataSnapshot.val().logo;
        } else {

          if (req.files.logo != null) {
            var file = req.files.logo,
              name = dataSnapshot.val().id + "." + file.name.split(".").pop(),
              type = file.mimetype;
            var path = '/storage/images/books/' + name;
            var uploadpath = __dirname + "/public" + path;
            if (dataSnapshot.val().logo !== "/storage/images/no-image.jpg") {
              fs.unlink(__dirname + "/public" + dataSnapshot.val().logo, function (error) {
                if (error) {
                  return;
                }
              });
            }
            file.mv(uploadpath, function (err) {
              if (err) {
                // firebase.database().ref().child('/books/' + uid).remove();
                res.redirect('/books');
              }
            });
          } else {
            var path = dataSnapshot.val().logo;
          }
        }

        var data = {
          id: dataSnapshot.val().id,
          name: req.body.name,
          author_id: req.body.author_id,
          section_id: req.body.section_id,
          year: req.body.year,
          count: req.body.count,
          logo: path,
          desc: req.body.desc
        }

        var updates = {};
        updates['/books/' + data.id] = data;
        firebase.database().ref().update(updates);

        res.redirect('/books');
      });

  });

app.get('/books/:id/delete', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "biblio") {
      firebase.database().ref().child('/books/' + req.params.id).once('value')
        .then(function (dataSnapshot) {
          if (dataSnapshot.val().logo !== "/storage/images/no-image.jpg") {
            fs.unlink(__dirname + "/public" + dataSnapshot.val().logo, function (error) {
              if (error) {
                return;
              }
            });
          }
          firebase.database().ref().child('/books/' + req.params.id).remove();
          res.redirect("/books");
        });
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});


app.post('/books/:id/favouriteAdd', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "reader") {
      var uid = firebase.database().ref().child('favourites').push().key;
      var data = {
        id: uid,
        book_id: req.params.id,
        user_id: req.session.user,
      }
      var updates = {};
      updates['/favourites/' + uid] = data;
      firebase.database().ref().update(updates);
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } else {
    res.sendStatus(404);
  }
});

app.post('/books/:id/favouriteDel', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "reader") {

      firebase.database().ref().child('/favourites/').once('value')
        .then(function (dataSnapshot) {
          var is = false;
          for (var key in dataSnapshot.val()) {
            if (dataSnapshot.val()[key].book_id === req.params.id && dataSnapshot.val()[key].user_id === req.session.user) {
              is = true;
              firebase.database().ref().child('/favourites/' + dataSnapshot.val()[key].id).remove();
            }
          }
          if (is) {
            res.sendStatus(200);
          } else {
            res.sendStatus(404);
          }
        });

    } else {
      res.sendStatus(404);
    }
  } else {
    res.sendStatus(404);
  }
});

app.get('/top100', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "reader") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;

          var dataBooks = [];
          for (var key in books) {
            var dataItem = {};
            dataItem.id = books[key].id;
            dataItem.name = books[key].name;
            dataItem.author_id = books[key].author_id;
            dataItem.author_first_name = authors[dataItem.author_id].first_name;
            dataItem.author_last_name = authors[dataItem.author_id].last_name;
            dataItem.section_id = books[key].section_id;
            dataItem.section_name = sections[dataItem.section_id].name;
            dataItem.year = books[key].year;
            dataItem.logo = books[key].logo;
            dataItem.countOrder = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === dataItem.id) {
                dataItem.countOrder++;
              }
            }
            dataItem.isFavourite = false;
            for (var key3 in favourites) {
              if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                dataItem.isFavourite = true;
              }
            }
            dataBooks.push(dataItem);
          }
          dataBooks.sort(orderByName);


          var topBooks = dataBooks.slice();
          topBooks.sort(orderByCountOrder);

          var top100Books = [];
          for (var i = 0; i < 100; i++) {
            if (i === topBooks.length) break;
            top100Books.push(topBooks[i])
          }


          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            dataBooks: top100Books,
            sections: sectionsList
          }

          res.render("reader/top100", {
            data: data
          });
        });
    } else {
      res.redirect("/books");
    }
  } else {
    res.redirect('/login');
  }
});


app.get('/favourites', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "reader") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;

          var dataBooks = [];
          for (var key in books) {
            var dataItem = {};
            dataItem.id = books[key].id;
            dataItem.name = books[key].name;
            dataItem.author_id = books[key].author_id;
            dataItem.author_first_name = authors[dataItem.author_id].first_name;
            dataItem.author_last_name = authors[dataItem.author_id].last_name;
            dataItem.section_id = books[key].section_id;
            dataItem.section_name = sections[dataItem.section_id].name;
            dataItem.year = books[key].year;
            dataItem.logo = books[key].logo;
            dataItem.countOrder = 0;
            for (var key2 in orders) {
              if (orders[key2].book_id === dataItem.id) {
                dataItem.countOrder++;
              }
            }
            var isFavourite = false;
            for (var key3 in favourites) {
              if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                isFavourite = true;
              }
            }
            if (isFavourite) {
              dataBooks.push(dataItem);
            }
          }

          var newBooks = dataBooks.slice().reverse();

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            newBooks: newBooks,
            sections: sectionsList
          }

          res.render("reader/favourites", {
            data: data
          });
        });
    } else {
      res.redirect("/books");
    }
  } else {
    res.redirect('/login');
  }
});

app.get('/sections', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var sections = dataSnapshot.val().sections;
          var books = dataSnapshot.val().books;
          var data = [];

          for (var key in sections) {
            var dataItem = {}
            dataItem.id = sections[key].id;
            dataItem.name = sections[key].name;
            dataItem.count = 0;
            for (var key2 in books) {
              if (books[key2].section_id === dataItem.id) {
                dataItem.count++;
              }
            }
            data.push(dataItem)
          }
          data.sort(orderByName);
          res.render(`${req.session.role}/sections`, {
            data: data
          });
        });
    } else {
      res.redirect("/dashboard");
    }
  } else {
    res.redirect('/login');
  }
});

app.route('/sections/add')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        res.render("biblio/add-section");
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    var uid = firebase.database().ref().child('sections').push().key;

    var data = {
      id: uid,
      name: req.body.name,
    }

    var updates = {};
    updates['/sections/' + uid] = data;
    firebase.database().ref().update(updates);

    res.redirect('/sections');
  });

app.get('/sections/:id', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var section = dataSnapshot.val().sections[req.params.id];
          var books = dataSnapshot.val().books;
          var sectionData = {};
          sectionData.id = section.id;
          sectionData.name = section.name;
          sectionData.count = 0;
          for (var key2 in books) {
            if (books[key2].section_id === sectionData.id) {
              sectionData.count++;
            }
          }
          var data = [];
          if (sectionData.count > 0) {
            var orders = dataSnapshot.val().orders;
            var authors = dataSnapshot.val().authors;

            for (var key in books) {
              if (books[key].section_id === sectionData.id) {
                var dataItem = {};
                dataItem.id = books[key].id;
                dataItem.name = books[key].name;
                dataItem.author_id = books[key].author_id;
                dataItem.author_first_name = authors[dataItem.author_id].first_name;
                dataItem.author_last_name = authors[dataItem.author_id].last_name;
                dataItem.count = books[key].count;
                dataItem.count_giv = 0;
                for (var key2 in orders) {
                  if (orders[key2].book_id === dataItem.id) {
                    dataItem.count_giv++;
                  }
                }
                dataItem.count_av = dataItem.count - dataItem.count_giv;

                data.push(dataItem);
              }
            }
            data.sort(orderByName);
          }
          res.render(`${req.session.role}/section-info`, {
            section: sectionData,
            books: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;
          var name = sections[req.params.id].name;
          var dataBooks = [];
          for (var key in books) {
            if (books[key].section_id === req.params.id) {
              var dataItem = {};
              dataItem.id = books[key].id;
              dataItem.name = books[key].name;
              dataItem.author_id = books[key].author_id;
              dataItem.author_first_name = authors[dataItem.author_id].first_name;
              dataItem.author_last_name = authors[dataItem.author_id].last_name;
              dataItem.section_id = books[key].section_id;
              dataItem.section_name = sections[dataItem.section_id].name;
              dataItem.year = books[key].year;
              dataItem.logo = books[key].logo;
              dataItem.countOrder = 0;
              for (var key2 in orders) {
                if (orders[key2].book_id === dataItem.id) {
                  dataItem.countOrder++;
                }
              }
              dataItem.isFavourite = false;
              for (var key3 in favourites) {
                if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                  dataItem.isFavourite = true;
                }
              }
              dataBooks.push(dataItem);
            }

          }
          dataBooks.sort(orderByName);

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            dataBooks: dataBooks,
            sections: sectionsList
          }

          res.render("reader/section-info", {
            name: name,
            data: data
          });
        });
    }
  } else {
    res.redirect('/login');
  }
});
app.route('/sections/:id/edit')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().child('/sections/' + req.params.id).once('value')
          .then(function (dataSnapshot) {
            res.render("biblio/edit-section", {
              data: dataSnapshot.val()
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    firebase.database().ref("sections/" + req.params.id).once('value')
      .then(function (dataSnapshot) {
        var section = dataSnapshot.val();
        var data = {
          id: section.id,
          name: req.body.name,
        }
        var updates = {};
        updates[`/sections/${section.id}`] = data;
        firebase.database().ref().update(updates);
        res.redirect('/sections');
      });
  });

app.get('/sections/:id/delete', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "biblio") {
      firebase.database().ref().child('/sections/' + req.params.id).remove();
      res.redirect("/sections");
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});


app.get('/authors', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var authors = dataSnapshot.val().authors;
          var books = dataSnapshot.val().books;
          var data = [];

          for (var key in authors) {
            var dataItem = {}
            dataItem.id = authors[key].id;
            dataItem.first_name = authors[key].first_name;
            dataItem.last_name = authors[key].last_name;
            dataItem.count = 0;
            for (var key2 in books) {
              if (books[key2].author_id === dataItem.id) {
                dataItem.count++;
              }
            }
            data.push(dataItem)
          }
          data.sort(orderByFirstName);
          res.render(`${req.session.role}/authors`, {
            data: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {

          var authors = dataSnapshot.val().authors;
          var books = dataSnapshot.val().books;
          var authorsList = [];

          for (var key in authors) {
            var dataItem = {}
            dataItem.id = authors[key].id;
            dataItem.first_name = authors[key].first_name;
            dataItem.last_name = authors[key].last_name;
            dataItem.count = 0;
            for (var key2 in books) {
              if (books[key2].author_id === dataItem.id) {
                dataItem.count++;
              }
            }
            authorsList.push(dataItem)
          }
          authorsList.sort(orderByFirstName);

          var sections = dataSnapshot.val().sections;

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }

          sectionsList.sort(orderByName);
          data = {
            authors: authorsList,
            sections: sectionsList
          }

          res.render("reader/authors", {
            data: data
          });
        });
    }
  } else {
    res.redirect('/login');
  }
});

app.route('/authors/add')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        res.render("biblio/add-author");
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    var uid = firebase.database().ref().child('authors').push().key;

    var data = {
      id: uid,
      first_name: req.body.first_name,
      last_name: req.body.last_name
    }

    var updates = {};
    updates['/authors/' + uid] = data;
    firebase.database().ref().update(updates);

    res.redirect('/authors');
  });

app.get('/authors/:id', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "admin" || req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var author = dataSnapshot.val().authors[req.params.id];
          var books = dataSnapshot.val().books;
          var authorData = {};
          authorData.id = author.id;
          authorData.first_name = author.first_name;
          authorData.last_name = author.last_name;
          authorData.count = 0;
          for (var key2 in books) {
            if (books[key2].author_id === authorData.id) {
              authorData.count++;
            }
          }
          var data = [];
          if (authorData.count > 0) {
            var sections = dataSnapshot.val().sections;
            var orders = dataSnapshot.val().orders;

            for (var key in books) {
              if (books[key].author_id === authorData.id) {
                var dataItem = {};
                dataItem.id = books[key].id;
                dataItem.name = books[key].name;
                dataItem.section_id = books[key].section_id;
                dataItem.section_name = sections[dataItem.section_id].name;
                dataItem.count = books[key].count;
                dataItem.count_giv = 0;
                for (var key2 in orders) {
                  if (orders[key2].book_id === dataItem.id) {
                    dataItem.count_giv++;
                  }
                }
                dataItem.count_av = dataItem.count - dataItem.count_giv;

                data.push(dataItem);
              }
            }
            data.sort(orderByName);
          }
          res.render(`${req.session.role}/author-info`, {
            author: authorData,
            books: data
          });
        });
    } else {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var sections = dataSnapshot.val().sections;
          var orders = dataSnapshot.val().orders;
          var favourites = dataSnapshot.val().favourites;
          var first_name = authors[req.params.id].first_name;
          var last_name = authors[req.params.id].last_name;
          var dataBooks = [];
          for (var key in books) {
            if (books[key].author_id === req.params.id) {
              var dataItem = {};
              dataItem.id = books[key].id;
              dataItem.name = books[key].name;
              dataItem.author_id = books[key].author_id;
              dataItem.author_first_name = authors[dataItem.author_id].first_name;
              dataItem.author_last_name = authors[dataItem.author_id].last_name;
              dataItem.section_id = books[key].section_id;
              dataItem.section_name = sections[dataItem.section_id].name;
              dataItem.year = books[key].year;
              dataItem.logo = books[key].logo;
              dataItem.countOrder = 0;
              for (var key2 in orders) {
                if (orders[key2].book_id === dataItem.id) {
                  dataItem.countOrder++;
                }
              }
              dataItem.isFavourite = false;
              for (var key3 in favourites) {
                if (favourites[key3].book_id === dataItem.id && favourites[key3].user_id === req.session.user) {
                  dataItem.isFavourite = true;
                }
              }
              dataBooks.push(dataItem);
            }

          }
          dataBooks.sort(orderByName);

          var sectionsList = [];
          for (var key in sections) {
            sectionsList.push(sections[key]);
          }
          sectionsList.sort(orderByName);
          data = {
            dataBooks: dataBooks,
            sections: sectionsList
          }

          res.render("reader/author-info", {
            name: `${first_name} ${last_name}`,
            data: data
          });
        });
    }
  } else {
    res.redirect('/login');
  }
});
app.route('/authors/:id/edit')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().child('/authors/' + req.params.id).once('value')
          .then(function (dataSnapshot) {
            res.render("biblio/edit-author", {
              data: dataSnapshot.val()
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    firebase.database().ref("authors/" + req.params.id).once('value')
      .then(function (dataSnapshot) {
        var author = dataSnapshot.val();
        var data = {
          id: author.id,
          first_name: req.body.first_name,
          last_name: req.body.last_name
        }
        var updates = {};
        updates[`/authors/${author.id}`] = data;
        firebase.database().ref().update(updates);
        res.redirect('/authors');
      });
  });

app.get('/authors/:id/delete', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "biblio") {
      firebase.database().ref().child('/authors/' + req.params.id).remove();
      res.redirect("/authors");
    } else {
      res.render("error", {
        error: "Доступ заборонено"
      });
    }
  } else {
    res.redirect('/login');
  }
});

app.get('/orders', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    if (req.session.role === "biblio") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var orders = dataSnapshot.val().orders;
          var books = dataSnapshot.val().books;
          var users = dataSnapshot.val().users;
          var data = [];

          for (var key in orders) {
            var dataItem = {}
            dataItem.id = orders[key].id;
            dataItem.user_id = orders[key].user_id;
            dataItem.user_first_name = users[dataItem.user_id].first_name;
            dataItem.user_last_name = users[dataItem.user_id].last_name;
            dataItem.book_id = orders[key].book_id;
            dataItem.book_name = books[dataItem.book_id].name;
            dataItem.date_giv = orders[key].date_giv;
            dataItem.date_ret = orders[key].date_ret;
            if (dataItem.date_ret !== "-") {
              dataItem.statusColor = "#d0e6ef"
            } else {
              var date = dataItem.date_giv.split("-");
              var yyyy = +date[0];
              var mm = +date[1];
              var dd = +date[2];
              otherDate = new Date(yyyy, mm - 1, dd);
              nowDate = new Date();
              delta = nowDate.getTime() - otherDate.getTime();
              var dayCount = Math.floor(delta / 1000 / 60 / 60 / 24);
              if (dayCount > 30) {
                dataItem.statusColor = "red"
              } else {
                dataItem.statusColor = "#f2f2f2"
              }
            }

            data.push(dataItem)
          }
          res.render("biblio/orders", {
            data: data.reverse()
          });
        });
    } else if (req.session.role === "reader") {
      firebase.database().ref().once('value')
        .then(function (dataSnapshot) {
          var orders = dataSnapshot.val().orders;
          var books = dataSnapshot.val().books;
          var authors = dataSnapshot.val().authors;
          var data = [];

          for (var key in orders) {
            if (orders[key].user_id === req.session.user) {
              var dataItem = {}
              dataItem.id = orders[key].id;
              dataItem.book_id = orders[key].book_id;
              dataItem.book_name = books[dataItem.book_id].name;
              dataItem.author_id = books[dataItem.book_id].author_id;
              dataItem.author_first_name = authors[dataItem.author_id].first_name;
              dataItem.author_last_name = authors[dataItem.author_id].last_name;

              dataItem.date_giv = orders[key].date_giv;
              dataItem.date_ret = orders[key].date_ret;
              if (dataItem.date_ret !== "-") {
                dataItem.statusColor = "#d0e6ef"
              } else {
                var date = dataItem.date_giv.split("-");
                var yyyy = +date[0];
                var mm = +date[1];
                var dd = +date[2];
                otherDate = new Date(yyyy, mm - 1, dd);
                nowDate = new Date();
                delta = nowDate.getTime() - otherDate.getTime();
                var dayCount = Math.floor(delta / 1000 / 60 / 60 / 24);
                if (dayCount > 30) {
                  dataItem.statusColor = "red"
                } else {
                  dataItem.statusColor = "#f2f2f2"
                }
              }
              data.push(dataItem)
            }
          }
          res.render("reader/orders", {
            data: data.reverse()
          });
        });
    } else {
      res.redirect('/dashboard');
    }
  } else {
    res.redirect('/login');
  }
});


app.route('/giving')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().once('value')
          .then(function (dataSnapshot) {
            var books = dataSnapshot.val().books;
            var users = dataSnapshot.val().users;
            var readers = [];
            for (var key in users) {
              if (users[key].role === "reader") {
                readers.push(users[key]);
              }
            }

            res.render("biblio/giving", {
              books: books,
              users: readers
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {
    var uid = firebase.database().ref().child('orders').push().key;

    var data = {
      id: uid,
      book_id: req.body.book_id,
      user_id: req.body.user_id,
      date_giv: getDate(),
      date_ret: "-"
    }

    var updates = {};
    updates['/orders/' + uid] = data;
    firebase.database().ref().update(updates);

    res.redirect('/orders');
  });

app.route('/return')
  .get((req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      if (req.session.role === "biblio") {
        firebase.database().ref().once('value')
          .then(function (dataSnapshot) {
            var books = dataSnapshot.val().books;
            var users = dataSnapshot.val().users;
            var orders = dataSnapshot.val().orders;

            var data = [];
            for (var key in orders) {
              if (orders[key].date_ret === "-") {
                var dataItem = {};
                dataItem.id = orders[key].id;
                dataItem.user_id = orders[key].user_id;
                dataItem.user_first_name = users[dataItem.user_id].first_name;
                dataItem.user_last_name = users[dataItem.user_id].last_name;
                dataItem.book_id = orders[key].book_id;
                dataItem.book_name = books[dataItem.book_id].name;

                data.push(dataItem);
              }
            }

            res.render("biblio/return", {
              data: data
            });
          });
      } else {
        res.render("error", {
          error: "Доступ заборонено"
        });
      }
    } else {
      res.redirect('/login');
    }
  })
  .post((req, res) => {

    var uid = firebase.database().ref().child('orders/' + req.body.order_id).once('value')
      .then(function (dataSnapshot) {
        var data = {
          id: dataSnapshot.val().id,
          book_id: dataSnapshot.val().book_id,
          user_id: dataSnapshot.val().user_id,
          date_giv: dataSnapshot.val().date_giv,
          date_ret: getDate()
        }

        var updates = {};
        updates['/orders/' + req.body.order_id] = data;
        firebase.database().ref().update(updates);

        res.redirect('/orders');
      });


  });



//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function (req, res) {
  res.render("error", {
    error: "Такої сторінки не існує"
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on port ${port}`));


function getDate() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  if (dd < 10) {
    dd = '0' + dd
  }

  if (mm < 10) {
    mm = '0' + mm
  }

  today = yyyy + '-' + mm + '-' + dd;
  return today;
}

function orderByLastName(a, b) {
  if (a.last_name < b.last_name)
    return -1;
  if (a.last_name > b.last_name)
    return 1;
  return 0;
}

function orderByFirstName(a, b) {
  if (a.first_name < b.first_name)
    return -1;
  if (a.first_name > b.first_name)
    return 1;
  return 0;
}

function orderByName(a, b) {
  if (a.name < b.name)
    return -1;
  if (a.name > b.name)
    return 1;
  return 0;
}

function orderByCountOrder(a, b) {
  if (a.countOrder > b.countOrder)
    return -1;
  if (a.countOrder < b.countOrder)
    return 1;
  return 0;
}