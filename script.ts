console.log('hello world')

type Variable = {
	name:string
	val:unknown
}

class Cell {
	name:string
	publicVariables:Variable[]
	private privateVariables:Variable[]
	constructor({name, publicVariables, privateVariables}:{name:string, publicVariables?:Variable[], privateVariables?:Variable[]}) {
		this.name = name
		this.publicVariables = []
		this.privateVariables = []
		if (publicVariables) {
			for (const publicVariable of publicVariables) {
				this.publicVariables.push(publicVariable)
			}
		}
		if (privateVariables) {
			for (const privateVariable of privateVariables) {
				this.privateVariables.push(privateVariable)
			}
		}
	}
}

const Grid = new (class {
	width:number
	height:number
	constructor(width:number, height:number) {
		this.width = width
		this.height = height
	}
})(30,30);

new Cell({name:'basic'})
