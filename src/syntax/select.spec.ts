import 'mocha';
import 'chai';
import { checkSelect, checkInvalid } from './spec-utils';
import { SelectedColumn, Expr, ExprBinary, JoinType, SelectStatement, Statement, LOCATION } from './ast';

describe('Select statements', () => {


    function noAlias(x: Expr[]): SelectedColumn[] {
        return x.map(expr => ({ expr }));
    }

    // yea... thats a valid query. Try it oO'
    checkSelect(['select'], {
        type: 'select',
    });

    checkSelect(['select 42', 'select(42)'], {
        type: 'select',
        columns: noAlias([{
            type: 'integer',
            value: 42
        }]),
    });

    checkSelect(['select count(*)'], {
        type: 'select',
        columns: noAlias([{
            type: 'call',
            function: 'count',
            args: [{ type: 'ref', name: '*' }],
        }])
    });

    checkSelect(['select 42, 53', 'select 42,53', 'select(42),53'], {
        type: 'select',
        columns: noAlias([{
            type: 'integer',
            value: 42
        }, {
            type: 'integer',
            value: 53
        }]),
    });

    checkSelect(['select * from test', 'select*from"test"', 'select* from"test"', 'select *from"test"', 'select*from "test"', 'select * from "test"'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }])
    });

    checkSelect(['select * from current_schema()', 'select * from current_schema ( )'], {
        type: 'select',
        from: [{ type: 'table', name: 'current_schema' }],
        columns: noAlias([{ type: 'ref', name: '*' }])
    });

    checkSelect(['select a as a1, b as b1 from test', 'select a a1,b b1 from test', 'select a a1 ,b b1 from test'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: [{
            expr: { type: 'ref', name: 'a' },
            alias: 'a1',
        }, {
            expr: { type: 'ref', name: 'b' },
            alias: 'b1',
        }],
    });

    checkSelect(['select * from db.test'], {
        type: 'select',
        from: [{ type: 'table', name: 'test', schema: 'db' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
    });


    checkSelect(['select * from test limit 5', 'select * from test fetch first 5', 'select * from test fetch next 5 rows'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        limit: { limit: 5 },
    });

    checkSelect(['select * from test limit 0'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        limit: { limit: 0 },
    });

    checkSelect(['select * from test limit 5 offset 3', 'select * from test offset 3 rows fetch first 5'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        limit: { limit: 5, offset: 3 },
    });

    checkSelect(['select * from test offset 3', 'select * from test offset 3 rows'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        limit: { offset: 3 },
    });


    checkSelect(['select * from test order by a asc limit 3', 'select * from test order by a limit 3'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        limit: { limit: 3 },
        orderBy: [{
            by: { type: 'ref', name: 'a' },
            order: 'ASC',
        }]
    });


    checkSelect(['select * from test order by a asc, b desc'], {
        type: 'select',
        from: [{ type: 'table', name: 'test' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        orderBy: [{
            by: { type: 'ref', name: 'a' },
            order: 'ASC',
        }, {
            by: { type: 'ref', name: 'b' },
            order: 'DESC',
        }]
    });

    checkSelect(['select a.*, b.*'], {
        type: 'select',
        columns: noAlias([{
            type: 'ref',
            name: '*',
            table: 'a',
        }, {
            type: 'ref',
            name: '*',
            table: 'b',
        }])
    });

    checkSelect(['select a, b'], {
        type: 'select',
        columns: noAlias([
            { type: 'ref', name: 'a' },
            { type: 'ref', name: 'b' }])
    });


    checkSelect(['select * from test a where a.b > 42' // yea yea, all those are valid & equivalent..
        , 'select*from test"a"where a.b > 42'
        , 'select*from test as"a"where a.b > 42'
        , 'select*from test as a where a.b > 42'], {
        type: 'select',
        from: [{ type: 'table', name: 'test', alias: 'a' }],
        columns: noAlias([{ type: 'ref', name: '*' }]),
        where: {
            type: 'binary',
            op: '>',
            left: {
                type: 'ref',
                table: 'a',
                name: 'b',
            },
            right: {
                type: 'integer',
                value: 42,
            },
        }
    });


    checkInvalid('select "*" from test');
    checkInvalid('select (*) from test');
    checkInvalid('select ("*") from test');
    checkInvalid('select * from (select id from test)'); // <== missing alias

    checkSelect('select * from (select id from test) d', {
        type: 'select',
        columns: noAlias([{ type: 'ref', name: '*' }]),
        from: [{
            type: 'statement',
            statement: {
                type: 'select',
                from: [{ type: 'table', name: 'test' }],
                columns: noAlias([{ type: 'ref', name: 'id' }]),
            },
            alias: 'd'
        }]
    })

    checkSelect(['select * from test group by grp', 'select * from test group by (grp)'], {
        type: 'select',
        columns: noAlias([{ type: 'ref', name: '*' }]),
        from: [{ type: 'table', name: 'test' }],
        groupBy: [{ type: 'ref', name: 'grp' }]
    })

    checkSelect(['select * from test group by a,b', 'select * from test group by (a,b)'], {
        type: 'select',
        columns: noAlias([{ type: 'ref', name: '*' }]),
        from: [{ type: 'table', name: 'test' }],
        groupBy: [
            { type: 'ref', name: 'a' },
            { type: 'ref', name: 'b' }
        ]
    })


    function buildJoin(t: JoinType): SelectStatement {
        return {
            type: 'select',
            columns: noAlias([{ type: 'ref', name: '*' }]),
            from: [{
                type: 'table',
                name: 'ta'
            }, {
                type: 'table',
                name: 'tb',
                join: {
                    type: t,
                    on: {
                        type: 'binary',
                        op: '=',
                        left: {
                            type: 'ref',
                            table: 'ta',
                            name: 'id',
                        },
                        right: {
                            type: 'ref',
                            table: 'tb',
                            name: 'id',
                        },
                    }
                }
            }]
        }
    }

    checkInvalid('select * from ta full inner join tb on ta.id=tb.id');
    checkInvalid('select * from ta left inner join tb on ta.id=tb.id');
    checkInvalid('select * from ta right inner join tb on ta.id=tb.id');

    checkSelect(['select * from ta join tb on ta.id=tb.id'
        , 'select * from ta inner join tb on ta.id=tb.id']
        , buildJoin('INNER JOIN'));

    checkSelect(['select * from ta left join tb on ta.id=tb.id'
        , 'select * from ta left outer join tb on ta.id=tb.id']
        , buildJoin('LEFT JOIN'));

    checkSelect(['select * from ta right join tb on ta.id=tb.id'
        , 'select * from ta right outer join tb on ta.id=tb.id']
        , buildJoin('RIGHT JOIN'));


    checkSelect(['select * from ta full join tb on ta.id=tb.id'
        , 'select * from ta full outer join tb on ta.id=tb.id']
        , buildJoin('FULL JOIN'));


    checkSelect(['select current_schema()'], {
        type: 'select',
        columns: [{
            expr: {
                type: 'call',
                function: {
                    type: 'keyword',
                    keyword: 'current_schema',
                },
                args: [],
            }
        }]
    })


    checkSelect(['select now()::time without time zone'], {
        type: 'select',
        columns: [{
            expr: {
                type: 'cast',
                operand: {
                    type: 'call',
                    function: 'now',
                    args: [],
                },
                to: { type: 'time without time zone' },
            }
        }]
    })

});
