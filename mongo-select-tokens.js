// get one enabled gcm push token of all active non-bot users
printjson(db.getCollection("users").aggregate([
    {
        $match: {
            type: "user",
            active: true
        }
    },
    {
        $lookup: {
            from: "_raix_push_app_tokens",
            let: {
                uId: "$_id"
            },
            pipeline: [  // this is a left outer join
                {
                    $match: {
                        $expr: {
                            $and:
                                [
                                    { $eq: [ "$userId",  "$$uId" ] },
                                    { $eq: [ "$enabled", true ] }
                                ]
                        }
                    }
                },
                {
                    $limit: 1  // we need just one enabled token per user for the gateway to work
                }
            ],
            as: "push"
        }
    },
    {
        $match: {
            "push.token.gcm": {
                $exists: true  // no love for iOS users :(
            }
        }
    },
    {
        $project: {
            _id: 0,
            uid: "$_id",
            uname: "$username",
            token: {
                $arrayElemAt: [ "$push.token.gcm", 0 ]  // at least one token exists at this stage
            }
        }
    }
]).toArray());
