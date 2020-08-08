import { createServer } from 'net'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'

enum Cmds {
    Move = 2614795397,
    Pick = 1169593071,
    Drop = 19469882,
    Player = 3623901639,
    // 10x10
    Elems = 1415591046,
    Inspect = 1083909441,
    Buy = 1326992884,
    Sell = 3777183679,
    Attack = 2257090568,
    Change1 = 249513676,
    Change2 = 817636993,
    Quit = 3509139905,
}

enum Params {
    Up = 1026868169,
    Down = 3930400191,
    Left = 4271926414,
    Right = 4265964054,
}

const LocMap: Record<number, [number, number] | undefined> = {
    [Params.Up]: [-1, 0],
    [Params.Down]: [1, 0],
    [Params.Left]: [0, -1],
    [Params.Right]: [0, 1],
}

type Location = [number, number]
type Item = {
    type: 'item'
    loc: Location | null
} | {
    type: 'player'
    loc: Location | null
}
type State = Record<string, Item>
const state: State = JSON.parse(readFileSync('../jsons/1596846885.json').toString())

const server = createServer((s) => {
    const rl = createInterface({
        input: s,
        // output: s,
    })
    const handler = (line: string) => {
        const [cmd, token, ...ps] = line.split(' ')
        if (cmd === 'AUTH') {
            s.write('OK\n')
            return
        }
        const ncmd = parseInt(cmd)
        const team = `P${parseInt(token[0])}`
        const nps = ps.map(i => parseInt(i, 10))
        switch(ncmd) {
            case Cmds.Move:
                const player = state[team]
                const dir = LocMap[nps[0]]
                if (!dir) {
                    throw new Error('Wrong args')
                }
                const [dy, dx] = dir
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                player.loc[0] += dy
                player.loc[1] += dx
                return
            default:
                console.log('unknown cmd', Cmds[ncmd], token, nps)
        }
    }
    rl.on('line', (input) => {
        try {
            let info = handler(input)
            s.write(JSON.stringify({
                status: 'OK',
                info,
            }))
        } catch(e) {
            s.write(JSON.stringify({
                status: 'ERROR',
                error_msg: e.message.toString(),
            }))
        }
    })
    s.write('HI\n')

})

server.listen(6666)
console.log('listening on 127.0.0.1:6666')
