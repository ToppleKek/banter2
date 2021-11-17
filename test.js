const macro_payload = {
    "name": "plarp",
    "event": "message",
    "conditionals": [
        {
            "lhs_src": "content",
            "operator": "contains",
            "rhs": "hi",
            "logic_op": "and"
        },
        {
            "lhs_src": "content",
            "operator": "contains",
            "rhs": "poop",
            "logic_op": "or"
        },
        {
            "lhs_src": "content",
            "operator": "equals",
            "rhs": "hello",
            "logic_op": ""
        }
    ],
    "responses": [
        {
            "action": "send_message",
            "args": [
                "<channel_id> (where)",
                "Hello $USER (content)"
            ]
        },
        {
            "action": "give_role",
            "args": [
                "<role id>"
            ]
        }
    ]

};

const macro = {
    guild: 'id',
    payload: macro_payload
};

const macro_errors = new Map();

function _add_error(guild, macro_name, error) {
    if (!macro_errors.has(guild))
        macro_errors.set(guild, []);

    macro_errors.get(guild).push({
        macro_name,
        error,
        last_run: Date.now()
    });
}

const payload = macro.payload;

console.log(`execute_macros (event=message): executing macro: ${payload.name} on guild: ${macro.guild}`);

let last_logic_op;
let last_result = true;
let evaluated_conditionals = [];

conditional_loop:
for (const conditional of payload.conditionals) {
    const lhs = "hi eater";

    if (!lhs) {
        _add_error(macro.guild, payload.name, `Invalid lhs source: ${conditional.lhs_src}`);
        continue;
    }

    let result;
    let not = conditional.operator.startsWith('!');

    if (not)
        conditional.operator = conditional.operator.substring(1);
    
    switch (conditional.operator) {
        case 'equals':
            result = lhs === conditional.rhs && !not;
            console.log(`equals operator lhs=${lhs} rhs=${conditional.rhs} result=${result}`);
            break;
        case 'contains':
            if (typeof lhs !== 'string' || typeof conditional.rhs !== 'string') {
                _add_error(macro.guild, payload.name, 'Operator "contains" requires two string operands');
                break conditional_loop; //continue macro_loop;
            }

            result = lhs.includes(conditional.rhs);
            console.log(`contains operator lhs=${lhs} rhs=${conditional.rhs} result=${result}`);
            break;
        default:
            _add_error(macro.guild, payload.name, 'Unimplemented or unknown operator: ' + conditional.operator);
            break conditional_loop; //continue macro_loop;
    }

    evaluated_conditionals.push({is_literal: true, value: result});

    if (conditional.logic_op !== '')
        evaluated_conditionals.push({is_literal: false, value: conditional.logic_op});

    // switch (last_logic_op) {
    //     case 'and':
    //         if (!last_result || !result) {
    //             last_result = false;
    //             last_logic_op = conditional.logic_op;
    //             continue;
    //         }

    //         last_result = true;
    //         last_logic_op = conditional.logic_op;
    //         break;
    //     case 'or':
    //         if (!last_result && !result) {
    //             last_result = false;
    //             last_logic_op = conditional.logic_op;
    //             continue;
    //         }

    //         last_result = true;
    //         last_logic_op = conditional.logic_op;
    // }
}

while (evaluated_conditionals.length > 1) {
    console.dir(evaluated_conditionals);
    let lhs;
    let operator;
    let rhs;

    if (evaluated_conditionals[0].is_literal)
        lhs = evaluated_conditionals[0].value;
    
    if (!evaluated_conditionals[1].is_literal)
        operator = evaluated_conditionals[1].value;
    
    if (evaluated_conditionals[2].is_literal)
        rhs = evaluated_conditionals[2].value;

    evaluated_conditionals = evaluated_conditionals.slice(2);

    switch (operator) {
        case 'and':
            evaluated_conditionals[0] = {is_literal: true, value: lhs && rhs};
            break;
    
        case 'or':
            evaluated_conditionals[0] = {is_literal: true, value: lhs || rhs};
            break;
    }
}
// for (let i = 0; i < evaluated_conditionals.length; i += 2) {
//     if (!evaluated_conditionals[i].is_literal || evaluated_conditionals[i + 1].is_literal || !evaluated_conditionals[i + 2].is_literal) {
//         _add_error(macro.guild, payload.name, 'Invalid eval format');
//         break;
//     }

//     switch (evaluated_conditionals[i + 1].value) {
//         case 'and':

//     }

    
// }

console.dir(macro_errors);
console.dir(evaluated_conditionals);
//console.log(`last_result=${last_result}`);
