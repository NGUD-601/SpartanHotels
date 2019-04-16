const mysql = require('mysql')
const config = require('./sql/config.js')

var connection = mysql.createConnection(config)

module.exports = {

    /**
    * Returns the result of a sql query as a promise.
    * onPromiseSuccess is function callback that is run on successful promise
    * onPromiseFailure is function callback that is run when promise failed
    * The name and parameter name for these callback functions does not matter.
    *
    * Example of use:
    *
    * var queryPromise = queryResultPromiser(some_query)
    * .then(
    *  function onPromiseSuccess(value_returned_when_promise_successful){
    *      // do stuff
    *  },
    *  function onPromiseFailure(value_returned_when_promise_failed){
    *      // do stuff
    *  }
    * )
    *
    * @param {query} query
    */
    run: function queryResultPromiser(query) {
        return new Promise((resolve, reject) => {
            connection.query(query, (error, results, fields) => {
                console.log('query being processed')
                if (error) {
                    // return console.error(error.message)
                    reject(error)
                }
                else{
                  console.log(`query result is ${JSON.stringify(results)}`)
                  resolve(results)
                } 
            })
        })
    },

    // Example queries to be used with pets db in config.js
    // Important: This means pets db must be specified in config.js, else an error will occur when query is run
    sql: `select * from pets where  age>4`,
    sql2: 'select * from pets where  name=?',


    user: {
        profile: 'select name, email, reward from spartanhotel.user where user_id=?',
        checkEmailExists: 'select * from user where email=?',
        checkUserNameExists: 'select user_id from spartanhotel.user where name=?',
        create: 'insert into spartanhotel.user (user_id,name,password,email) values (null,?,?,?)',
        session: 'select LAST_INSERT_ID() as user_id ',
        authenticate: 'select user_id, password from spartanhotel.user where email=?',
        getAvailableRewards: 'SELECT sum(R.change) as sum FROM spartanhotel.reward R where user_id=? and date_active <= curdate();'
    },

    hotel: {
      /**
       * Returns [ queryWithQuestionMarks, [placeholders] ]
       * @param {*} params 
       * Required: date_in, date_out
       * Optional: city, state, zip, pageNumber, resultsPerPage
       * @param {boolean} getCount 
       * When true, the resulting query will only return COUNT(*) of all possible results w/o regard to pagination parameters
       * Default: false
       */
        search: function (params={}, getCount=false) {
            // Example parameter: { name: "mint", category: "baby", sortByAsc: true,  priceGreaterThan: 2, priceLessThan: 5 }
            /*
              from StackOverflow, Jordan Running,
              https://stackoverflow.com/questions/31822891/how-to-build-dynamic-query-by-binding-parameters-in-node-js-sql#31823325
              
            */


            /* USING THIS
            Example of Query to see what is available:

            with 
            rb as (SELECT  B.*, R.hotel_id, R.room_number, R.price, R.bed_type, R.bed_number 
            from spartanhotel.booking B join spartanhotel.room R 
            on B.room_id = R.room_id where date_in < '2019-03-21' and date_out > '2019-03-08')
            
            select * from room 
            join hotel
            on room.hotel_id = hotel.hotel_id {AND hotel.hotel_id = ?}
            where not
            exists (select * from rb where rb.room_id = room.room_id AND rb.status != 'cancelled')
            ;
            */
            
            /* NOT USING THIS, BUT HERE FOR REFERENCE
            Example of query to see which rooms not available:

            SELECT * FROM 
            ( select  B.*, R.hotel_id, R.room_number, R.price, R.bed_type, R.bed_number 
            from spartanhotel.booking B join spartanhotel.room R 
            on B.room_id = R.room_id where date_in < '2019-03-05' and date_out > '2019-03-02' and status != 'cancelled' ) as BR
            ;
            */

        
        
            // 'With clause' sets up date checking
            var dateConditions = []
            let tempTableComponent = `with 
            rb as (SELECT  B.*, R.hotel_id, R.room_number, R.price, R.bed_type
            from spartanhotel.booking B join spartanhotel.room R 
            on B.room_id = R.room_id `

             // Date Conditions
             if (typeof params.date_out !== 'undefined' && params.date_out !== '') {
              dateConditions.push(params.date_out)
            }
             if (typeof params.date_in !== 'undefined' && params.date_in !== '') {
              dateConditions.push(params.date_in)
            }
                        
            let withClause = mysql.format(tempTableComponent + "where date_in < ? and date_out > ?) ", dateConditions)


            // All other query parameters
            var conditions = [];
            var values = [];
            


            // CITY - Exact match
            if (typeof params.city !== 'undefined' && params.city !== '') {
              conditions.push("city like ?");
              values.push("" + params.city + "");
            }
            // STATE - Exact match
            if (typeof params.state !== 'undefined' && params.state !== '') {
              conditions.push("state like ?");
              values.push("" + params.state + "");
            }
            // ZIP - Exact match
            if (typeof params.zip !== 'undefined' && params.zip !== '') {
              conditions.push("zipcode = ?");
              values.push("" + params.zip + "");
            }



            
            

            // WHERE/FILTER CLAUSE
            // TODO: filter by distance
            if (typeof params.amenities !== 'undefined'){
              let amenities = JSON.parse(decodeURIComponent(params.amenities))
              for(var i=0;i< amenities.length;i++){
                conditions.push(" amenities like ? ");
                values.push("%" + amenities[i] + "%");
              }


            }

            if (typeof params.rating !== 'undefined'){
              let rating = parseInt(params.rating)
              conditions.push(" rating = ? ");
              values.push(rating);
            }


            if (typeof params.priceGTE !== 'undefined' && params.priceGTE !== '') {
              conditions.push("price >= ?");
              values.push(params.priceGTE);
            }
        
            if (typeof params.priceLTE !== 'undefined' && params.priceLTE !== '') {
              conditions.push("price <= ?");
              values.push(params.priceLTE);
            }
        

        
            var whereClause = conditions.length ? conditions.join(' AND ') : '1'

            // SORT BY CLAUSE
            // TODO: sort by distance
            var sortByClause = " order by name "; 
            if (typeof params.sortBy !== 'undefined' && params.sortBy !== '') {
              switch (params.sortBy) {
                case ("rating_asc"):
                  sortByClause = " order by rating ";
                  break
                case ("rating_des"):
                  sortByClause = " order by rating desc "
                  break
                case ("name_asc"):
                  sortByClause = " order by name ";
                  break
                case("name_des"):
                  sortByClause = " order by name desc ";
                  break
                case("price_asc"):
                  sortByClause = " order by min_price ";
                  break
                case("price_des"):
                  sortByClause = " order by min_price desc ";
                  break
                default:
                  sortByClause = " order by name "
              }
            }
        
            // PAGINATION
            var pageNumber = 0;
            var resultsPerPage = 10;

            if (typeof params.pageNumber !== 'undefined' && params.pageNumber !== '') {
              pageNumber = params.pageNumber;
            }
            if (typeof params.resultsPerPage !== 'undefined' && params.resultsPerPage !== '') {
              resultsPerPage = params.resultsPerPage;
            }
        

            var paginationClause = " limit " + resultsPerPage + " offset " + (pageNumber * resultsPerPage) + " "


            // PUTTING QUERY TOGETHER
            let mainQuery = ''
            if(getCount){
              mainQuery = ` SELECT COUNT( distinct hotel.hotel_id ) as count `
            }else{
              mainQuery = ' SELECT  distinct hotel.*, min(price) as min_price, max(price) as max_price, count(room_id) as rooms_available '
            }

            if (typeof params.priceLTE !== 'undefined' && params.priceLTE !== '') {
              conditions.push("price <= ?");
              values.push(params.priceLTE);
            }

            let hotelIDClause = ""
            if (typeof params.hotel_id !== 'undefined' && params.hotel_id !== '') {
              let hotelIDComponent = " AND hotel.hotel_id = ?"
              hotelIDClause = mysql.format(hotelIDComponent, params.hotel_id)
            }

            mainQuery = mainQuery +
              `FROM
                  room
                      JOIN
                  hotel ON room.hotel_id = hotel.hotel_id` + hotelIDClause + `
              
              WHERE
                  NOT EXISTS(
                    SELECT 
                          *
                      FROM
                          rb
                      WHERE
                          rb.room_id = room.room_id
                              AND rb.status != 'cancelled')
                  AND 
              `
          let query = ''
          let groupByClause = ' group by room.hotel_id '
          if(getCount){
            query = withClause + mainQuery + whereClause + ';'
          }else{
            // wrap query inside a select so we can join the results with hotel images
            query = ` select rh.*, group_concat(url) as images from ( ` + 
              withClause + mainQuery + whereClause + groupByClause + 
              `
                ) as rh
                left join
                hotel_image
                on hotel_image.hotel_id = rh.hotel_id
                group by
                rh.hotel_id
              `
              + sortByClause + paginationClause  + 
              ';'
          }
          
          // console.log("QUERIES.JS " + query)

          // console.log(values)
        
          return [query, values]
        
        },
        room: function (params = {}, queryString={}, getCount=false) {
          // Example parameter: { name: "mint", category: "baby", sortByAsc: true,  priceGreaterThan: 2, priceLessThan: 5 }
          /*
            from StackOverflow, Jordan Running,
            https://stackoverflow.com/questions/31822891/how-to-build-dynamic-query-by-binding-parameters-in-node-js-sql#31823325
            
          */
      
          // 'With clause' sets up date checking for available rooms at specific hotel
          // 'With clause' results in a table of rooms booked during the given time at the given hotel
          var withConditions = []
          let tempTableComponent = `with 
          rb as (SELECT  B.*, R.hotel_id, R.room_number, R.price, R.bed_type
          from spartanhotel.booking B join spartanhotel.room R 
          on B.room_id = R.room_id `
      
           // Date Conditions
           if (typeof queryString.date_out !== 'undefined' && queryString.date_out !== '') {
            withConditions.push(queryString.date_out)
          }
           if (typeof queryString.date_in !== 'undefined' && queryString.date_in !== '') {
            withConditions.push(queryString.date_in)
          }
          // Specific Hotel
          if (typeof params.hotelID !== 'undefined' && params.hotelID !== '') {
            withConditions.push(params.hotelID)
          }
                     
          let withClause = mysql.format(tempTableComponent + "where date_in < ? and date_out > ? and hotel_id = ?) ", withConditions)
      
      
          // All other query parameters
          var conditions = [];
          var values = [];
      
          // WHERE/FILTER CLAUSE
      
          // Useful only if rooms have different amenities and ratings
          // if (typeof queryString.amenities !== 'undefined'){
          //   let amenities = JSON.parse(decodeURIComponent(queryString.amenities))
          //   for(var i=0;i< amenities.length;i++){
          //     conditions.push(" amenities like ? ");
          //     values.push("%" + amenities[i] + "%");
          //   }
          // }
          // if (typeof params.rating !== 'undefined'){
          //   let rating = parseInt(params.rating)
          //   conditions.push(" rating = ? ");
          //   values.push(rating);
          // }
      
      
          if (typeof queryString.priceGTE !== 'undefined' && queryString.priceGTE !== '') {
            conditions.push("price >= ?");
            values.push(queryString.priceGTE);
          }
      
          if (typeof queryString.priceLTE !== 'undefined' && queryString.priceLTE !== '') {
            conditions.push("price <= ?");
            values.push(queryString.priceLTE);
          }
      
          conditions.push("hotel_id = ?")
          values.push(params.hotelID)
      
      
      
          var whereClause = conditions.length ? conditions.join(' AND ') : '1'
             
          // SORT BY CLAUSE
            // TODO: sort by distance
            var sortByClause = ""; 
            if (typeof queryString.sortBy !== 'undefined' && queryString.sortBy !== '') {
              switch (queryString.sortBy) {
              // Useful only if rooms have different amenities and ratings
              // case ("rating_asc"):
              //   sortByClause = " order by rating ";
              //   break
              // case ("rating_des"):
              //   sortByClause = " order by rating desc "
              //   break
                case ("name_asc"):
                  sortByClause = " order by name ";
                  break
                case("name_des"):
                  sortByClause = " order by name desc ";
                  break
                case("price_asc"):
                  sortByClause = " order by price ";
                  break
                case("price_des"):
                  sortByClause = " order by price desc ";
                  break
                default:
                  sortByClause = " order by price "
              }
            }
      
          // PAGINATION
          var pageNumber = 0;
          var resultsPerPage = 10;
      
          if (typeof queryString.pageNumber !== 'undefined' && queryString.pageNumber !== '') {
            pageNumber = queryString.pageNumber;
          }
          if (typeof queryString.resultsPerPage !== 'undefined' && queryString.resultsPerPage !== '') {
            resultsPerPage = queryString.resultsPerPage;
          }
      
          var paginationClause = " limit " + resultsPerPage + " offset " + (pageNumber * resultsPerPage) + " "
      
      
          // PUTTING QUERY TOGETHER
          let mainQuery = ''
          if(getCount){
            mainQuery = ` SELECT COUNT( * ) as count `
          }else{
            mainQuery = ' SELECT  * '
          }
          mainQuery = mainQuery +
            `FROM
                room
            WHERE
                NOT EXISTS(
                  SELECT 
                        *
                    FROM
                        rb
                    WHERE
                        rb.room_id = room.room_id
                            AND rb.status != 'cancelled')
                AND 
            `
        let query = ''
      
        if(getCount){
          query = withClause + mainQuery + whereClause + ';'
        }else{
          // wrap query inside a select so we can join the results with hotel images
          query = ` select rh.*, group_concat(url) as images from ( ` + 
          withClause + mainQuery + whereClause + 
          `
            ) as rh
            left join
            room_image
            on room_image.hotel_id = rh.hotel_id and room_image.bed_type = rh.bed_type
            group by
            rh.room_id
          `
          + sortByClause + paginationClause  + 
          ';'
        }
        return [query, values]
      },

    },


    booking: {
      /**
       * 
       * @returns placeholder query to insert into transaction table
       */
      makeTransaction: 'INSERT INTO spartanhotel.transaction(transaction_id, user_id, guest_id, total_price, cancellation_charge, date_in, date_out, status, amount_paid, stripe_id) values (null, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      
      /**
       * Insert into transaction_room table
       * @param {*} transaction_id 
       * @param {[{}]} rooms_booked [{room:19, price:200},{room:20, price:400}]
       * @returns A formatted query ie "INSERT INTO spartanhotel.transaction_room(transaction_id, room_id, room_price) VALUES (39,10,20),(39,11,65)"
       */
      makeTransactionDetails: function(transaction_id, rooms_booked){
        let insertStatement = "INSERT INTO spartanhotel.transaction_room(transaction_id, room_id, room_price) VALUES "
        let placeholders = []
        let values = []
        for(i=0;i<rooms_booked.length;i++){
          placeholders.push("(?,?,?)")
          values.push(transaction_id)
          values.push(rooms_booked[i].room)
          values.push(rooms_booked[i].price)
        }
        let placeholderComponent = placeholders.join(",")
        return mysql.format(insertStatement + placeholderComponent,values)
      },
    book: 'INSERT INTO spartanhotel.booking(booking_id, user_id, guest_id, room_id, total_price, cancellation_charge, date_in, date_out, status, amount_paid) values (null, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    cancel: 'UPDATE booking SET status="cancelled" WHERE booking_id=?',
    modify: 'UPDATE booking SET room_id=?, date_in=?, date_out=? WHERE booking_id=?',

    /**
     * 
     * @param {*} user_id 
     * @param {*} date_in 
     * @param {*} date_out 
     * @returns A query, which when run -> returns an array of bookings which conflict with the given inputs, else returns empty array
     */
      duplicateBookingCheck: function({user_id, date_in, date_out}){
        let query = `
        SELECT 
          B.*,
          R.hotel_id,
          R.room_number,
          R.price,
          R.bed_type
        FROM
            spartanhotel.booking B
                JOIN
            spartanhotel.room R ON B.room_id = R.room_id
        WHERE
            date_in < ?
                AND date_out > ?
                AND user_id = ?
                AND status != 'cancelled'          
        ;
        `
        return mysql.format(query, [date_out, date_in, user_id])
      },

      /**
     * 
     * @param {*} params 
     * {date_in, date_out, rooms:[room_ids]}
     * @returns {[]} 
     * 
     * This returns a query, that when run, will:
     * 
     * Return an array containing the room ids from rooms that are already booked
     * eg
     * 
     * params: {date_in: '2019-03-10', date_out: '2019-03-12', rooms:[1,2,3]}
     * 
     * rooms 1 and 2 are already booked
     * 
     * then
     * returns [1,2]
     * 
     * Else, returns an error message
     * 
      */
    isAlreadyBooked: function(params = {}){

      let roomsBookedQuery = `
      SELECT 
        distinct(B.room_id)
      FROM
          spartanhotel.booking B
      WHERE
          date_in < ?
              AND date_out > ?
              AND status != 'cancelled'
              AND ` 
      ;
      let roomIdCondition = ""
      let placeholderValues = []
      let roomIdConditionQueryComponent = []
      placeholderValues.push(params.date_out)
      placeholderValues.push(params.date_in)


      for(i=0;i<params.rooms.length;i++){
        roomIdConditionQueryComponent.push("B.room_id = ?")
        placeholderValues.push(params.rooms[i])
      }
      roomIdCondition = roomIdConditionQueryComponent.join(" or ")

      roomsBookedQuery = roomsBookedQuery + "(" + roomIdCondition + ")"

      // console.log(roomsBookedQuery)

      
      let sql = mysql.format(roomsBookedQuery, placeholderValues)
      console.log(sql)
      
      return sql
    

  },

   /**
     * 
     * @param {*} params 
     * {date_in, date_out, rooms:[room_ids]}
     * @returns [{}] An array of {room_id, hotel_id, room_number, price, bed_type, capacity, booked}
     * booked = 0 means not booked
     * 
     * This returns a query, that when run, will:
     * 
     * Return an array containing the booked status and pricing info of each requested room
     * eg
     * 
     * params: {date_in: '2019-03-10', date_out: '2019-03-12', rooms:[1,2,3]}
     * 
     * rooms 1 and 2 are already booked
     * 
     * then
     * returns [{room_id:1, hotel_id, room_number, price, bed_type, capacity, 1},
     * {room_id:2, hotel_id, room_number, price, bed_type, capacity, 1},
     * {room_id:3, hotel_id, room_number, price, bed_type, capacity, 0}]
     * 
     * Else, returns an error message
     * 
      */
     bookableAndPriceCheck: function(params = {}){

      // let q = `
      // SELECT 
      // A.*, (case when B_room_id IS NULL then FALSE else TRUE end)  as booked
      // FROM
      //     (SELECT 
      //         *
      //     FROM
      //         room R
      //     WHERE
      //         (R.room_id = 9 OR R.room_id = 11
      //             OR R.room_id = 8)) AS A
      // LEFT JOIN
      //     (SELECT DISTINCT
      //         (room_id) AS B_room_id
      //     FROM
      //         spartanhotel.booking B
      //     WHERE
      //         date_in < '2019-03-21'
      //             AND date_out > '2019-03-02'
      //             AND status != 'cancelled'
      //             AND (room_id = 9 OR room_id = 11
      //             OR room_id = 8)) 
      // AS AB ON A.room_id = B_room_id                                                              
      // `
      
      let q1 = `
      SELECT 
      A.*, (case when B_room_id IS NULL then FALSE else TRUE end)  as booked
      FROM
          (SELECT 
              *
          FROM
              room R
          WHERE
              
      `
      // (R.room_id = 9 OR R.room_id = 11
      //   OR R.room_id = 8))
      let placeholderComponentForRooms = []
      let placeholderValues = []
      let rooms = []
      for(i=0;i<params.rooms.length;i++){
        placeholderComponentForRooms.push("room_id = ?")
        rooms.push(params.rooms[i])
      }
      console.log(`AAA ${rooms}`)
      let roomIdCondition = "(" + placeholderComponentForRooms.join(" or ") + ")"

      q1 = q1 + " " + roomIdCondition +")"
      placeholderValues.push.apply(placeholderValues, rooms)
      console.log(placeholderValues)


      let q2 = `
      AS A
      LEFT JOIN
          (SELECT DISTINCT
              (room_id) AS B_room_id
          FROM
              spartanhotel.booking B
          WHERE
              date_in < ?
                  AND date_out > ?
                  AND status != 'cancelled'
                  AND 
      `
      // (room_id = 9 OR room_id = 11
      //   OR room_id = 8))
      
      placeholderValues.push(params.date_out)
      placeholderValues.push(params.date_in)

      q2 = q2 + " " + roomIdCondition + ")"
      placeholderValues.push.apply(placeholderValues, rooms)


      let q3 = `
      AS AB ON A.room_id = B_room_id                                                              
      `

      let q = q1 + q2 + q3

      console.log(q)

      
      let sql = mysql.format(q, placeholderValues)
      console.log(sql)
      return sql
  },
      





      /**
     * 
     * @param {*} params 
     * {date_in, date_out, rooms:[room_ids]}
     * @returns {*} 
     * 
     * This returns a query, that when run, will:
     * 
     * Return an array containing an object
     * eg
     * [{"available":1,"room_id":9,"hotel_id":5,"room_number":210,"price":138.46,"bed_type":"King"}]
     * available is false if = 0
     * 
     * Else, returns an error message
     * 
      */
    isBookable: function(params = {}){
      let query = `
      SELECT 
      *
      FROM
          (SELECT 
              NOT EXISTS( SELECT 
                          *
                      FROM
                          spartanhotel.booking B
                      JOIN spartanhotel.room R ON B.room_id = R.room_id
                      WHERE
                          date_in < ?
                              AND date_out > ?
                              AND status != 'cancelled'
                              AND R.room_id = ?) AS available
          ) AS availability
              JOIN
          spartanhotel.room
      WHERE
          room_id = ?
      ;
      
      `

      let values = [];
      if (typeof params.date_out !== 'undefined' && params.date_out !== '') {
        values.push(params.date_out)
      }
      if (typeof params.date_in !== 'undefined' && params.date_in !== '') {
        values.push(params.date_in)
      }
      if (typeof params.room_id !== 'undefined' && params.room_id !== '') {
        values.push(params.room_id)
        values.push(params.room_id)
      }
      let sql = mysql.format(query, values)
      console.log(sql)

      return sql

  },
},

    rewards: {
      book: 'INSERT INTO spartanhotel.rewards (reward_book_id, user_id, room_id, reward_points, no_cancellation, date_in, date_out, status) values (null, ?, ?, ?, ?, ?, ?, ?)',
      useOnBooking: 'INSERT INTO spartanhotel.reward (reward_id, user_id, reward_reason_id, transaction_id, date_active, `change`) values (null, ?, 1, ?, curdate(), ?)',
      gainFromBooking: 'INSERT INTO spartanhotel.reward (reward_id, user_id, reward_reason_id, transaction_id, date_active, `change`) values (null, ?, 2, ?, ?, ?)',
      getUserRecords: 'SELECT R.*,RR.reason FROM spartanhotel.reward R join spartanhotel.reward_reason RR on R.reward_reason_id = RR.reward_reason_id WHERE user_id=?',
      cancelBooking: 'DELETE from spartanhotel.reward where booking_id=?'
    },

    guest: {
      insert: 'INSERT INTO spartanhotel.guest(guest_id, email, name) values (null, ?, ?)'
    }



}