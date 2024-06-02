const Book = require('./models/book')
const Author = require('./models/author')
const { GraphQLError, subscribe } = require('graphql')

const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const resolvers = {
    Query: {
      bookCount: async () => Book.collection.countDocuments(),
      authorCount: async () => Author.collection.countDocuments(),
      allBooks: async (root, args) => {
        // Unimplemented: with the parameter author
        const genre = args.genre
        if (!genre) {
          return Book.find({})
        }
        return Book.find({ genres: genre })
      },
      allAuthors: async () => {
        console.log('Author.find')
        const authors = await Author.find({})
        // console.log(authors)
        return authors
      },
      me: async (root, args, { currentUser }) => {
        return currentUser
      }
    },
    Book: {
      author: async (root) => {
        const authorId = root.author
        return Author.findById(authorId)
      }
    },
    // Author: {
    //   bookCount: async (root) => {
    //     console.log('Book.find')
    //     const books = await Book.find({
    //         author: {
    //             $eq: root.id
    //         }
    //     })
    //     return books.length
    //   }
    // },
    Mutation: {
      addBook: async (root, args, context) => {
        if (!context.currentUser) {
          throw new GraphQLError('not authenticated', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          })
        }
  
        let author = await Author.findOne({ name: args.author })
        if (!author) {
          author = new Author({ name: args.author })
          try {
            await author.save()
          } catch (error) {
            throw new GraphQLError('Saving author failed', {
              extensions: {
                code: 'BAD_USER_INPUT',
                invalidArgs: args.name,
                error
              }
            })
          }
        }
        const book =  new Book({ ...args, author: author._id })
        try {
          await book.save()
          author.bookCount += 1
          await author.save()
        } catch (error) {
          throw new GraphQLError('Saving book failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
            }
          })
        }

        pubsub.publish('BOOK_ADDED', { bookAdded: book })

        return book
      },
      editAuthor: async (root, args, context) => {
        if (!context.currentUser) {
          throw new GraphQLError('not authenticated', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          })
        }
        const author = await Author.findOne({ name: args.name })
        if (!author) {
          return null
        }
        author.born = args.setBornTo
        return author.save()
      },
      createUser: async (root, args) => {
        const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
  
        return user.save()
          .catch(error => {
            throw new GraphQLError('Creating the user failed', {
              extensions: {
                code: 'BAD_USER_INPUT',
                invalidArgs: args.username,
                error
              }
            })
          })
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })
  
        if (!user || args.password !== 'secret') {
          throw new GraphQLError('wrong credentials', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          })
        }
  
        const userForToken = {
          id: user._id,
          username: user.username
        }
  
        return { value: jwt.sign(userForToken, process.env.JWT_SECRET)}
      }
    },
    Subscription: {
        bookAdded: {
            subscribe: () => pubsub.asyncIterator('BOOK_ADDED')
        }
    }
  }

module.exports = resolvers
