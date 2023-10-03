const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Author = require('./models/authors')
const Book = require("./models/books")
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })



// let authors = [
//   {
//     name: 'Robert Martin',
//     id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
//     born: 1952,
//   },
//   {
//     name: 'Martin Fowler',
//     id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
//     born: 1963
//   },
//   {
//     name: 'Fyodor Dostoevsky',
//     id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
//     born: 1821
//   },
//   { 
//     name: 'Joshua Kerievsky', 
//     id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
//   },
//   { 
//     name: 'Sandi Metz', 
//     id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
//   },
// ]


// let books = [
//   {
//     title: 'Clean Code',
//     published: 2008,
//     author: 'Robert Martin',
//     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Agile software development',
//     published: 2002,
//     author: 'Robert Martin',
//     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
//     genres: ['agile', 'patterns', 'design']
//   },
//   {
//     title: 'Refactoring, edition 2',
//     published: 2018, 
//     author: 'Martin Fowler',
//     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Refactoring to patterns',
//     published: 2008,
//     author: 'Joshua Kerievsky',
//     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'patterns']
//   },  
//   {
//     title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
//     published: 2012,
//     author: 'Sandi Metz',
//     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'design']
//   },
//   {
//     title: 'Crime and punishment',
//     published: 1866,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'crime']
//   },
//   {
//     title: 'The Demon ',
//     published: 1872,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'revolution']
//   },
// ]

const typeDefs = `  
  type Author {
    name: String!
    born: Int
  }

  type Book {
    title: String
    published: Int
    author: Author!
    genres: [String!]!
  }
  type AllAuthors {
    name: String!
    born: Int
    bookCount: Int!
  }
  schema {
    mutation: Mutation
  }
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
  }
  type Mutation {
    addBook(
      title: String
      author: String!
      published: Int
      genres: [String!]!
    ): Book
    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }
  type Mutation {
    editAuthor(name: String!, setBornTo: Int!): Author
  }
  
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [AllAuthors!]!
    me: User
  }
`;


const resolvers = {
  Query: {
    bookCount: async () => {
      try {
        const count = await Book.countDocuments();
        return count;
      } catch (error) {
        throw new Error('Unable to fetch book count.');
      }
    },
    authorCount: async () => {
      try {
        const count = await Author.countDocuments();
        return count;
      } catch (error) {
        throw new Error('Unable to fetch author count.');
      }
    },
    allBooks: async (_, { author, genre }) => {
      let query = {};
    
      if (author) {
        const authorObj = await Author.findOne({ name: author });
        if (authorObj) {
          query.author = authorObj._id;
        }
      }
    
      if (genre) {
        query.genres = genre;
      }
    
      try {
        const books = await Book.find(query).populate('author');
        return books;
      } catch (error) {
        throw new Error('Unable to fetch books.');
      }
    },
    allAuthors: async () => {
      try {
        const authorsWithBookCount = await Author.aggregate([
          {
            $lookup: {
              from: 'books',
              localField: '_id',
              foreignField: 'author',
              as: 'books'
            }
          },
          {
            $project: {
              name: 1,
              born: 1,
              bookCount: { $size: '$books' }
            }
          }
        ]);
    
        return authorsWithBookCount;
      } catch (error) {
        throw new Error('Unable to fetch authors with book count.');
      }
    },
    me: (root, args, context) => {
      return context.currentUser
    }
  },
  Mutation: {
    addBook: async (root, args) => {
      let author = await Author.findOne({ name: args.author });
    
      if (!author) {
        // If the author doesn't exist, create a new author
        author = new Author({ name: args.author });
        console.log(author)
        await author.save();
      }
    
      // Create a new book
      let book = new Book({
        author: author._id,
        genres: args.genres,
        published: args.published,
        title: args.title,
      });
    
      // Save the book to the database
      try {
        await book.save();
      } catch (error) {
        throw new GraphQLError('Saving user failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.name,
            error
          }
        })
      }
    
      // Return the book, including the author information
      return {
        ...book.toObject(),
        author: author.toObject(), // Convert author to plain JavaScript object
      };
    },
    createUser: async (root, args) => {
      const user = new User({ username: args.username })
  
      return user.save()
        .catch(error => {
          throw new GraphQLError('Creating the user failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
            }
          })
        })
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
  
      if ( !user || args.password !== 'secret' ) {
        throw new GraphQLError('wrong credentials', {
          extensions: { code: 'BAD_USER_INPUT' }
        })        
      }
  
      const userForToken = {
        username: user.username,
        id: user._id,
      }
  
      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
    },

    editAuthor: async (_, { name, setBornTo }) => {
      const author = await Author.findOne({ name });
      author.born = setBornTo;
      try {
        await author.save();
      } catch (error) {
          throw new GraphQLError('Editing number failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
            }
          })
      }
  
      return author;
    },
  }
};



const server = new ApolloServer({
  typeDefs,
  resolvers,
});


startStandaloneServer(server, {
  listen: { port: 4001 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.startsWith('Bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id).populate('friends')
      return { currentUser }
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})
