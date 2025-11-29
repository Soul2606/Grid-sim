console.log('hello world')

type Variable = {
	name:string
	val:unknown
}

class Vector2D {
	x:number
	y:number
	constructor(x:number, y:number){
		this.x = x
		this.y = y
	}

	equal(vec:Vector2D):boolean{
		return (this.x === vec.x && this.y === vec.y)
	}
}

class Cell {
	name:string
	publicVariables:Variable[]
	readonly isReference:boolean
	private privateVariables:Variable[]
	constructor({name, publicVariables=[], privateVariables=[], isReference=false}:{name:string, publicVariables?:Variable[], privateVariables?:Variable[], isReference?:boolean}) {
		this.name = name
		this.publicVariables = []
		this.privateVariables = []
		this.isReference = isReference
	
		for (const publicVariable of publicVariables) {
			this.publicVariables.push(publicVariable)
		}
	
		for (const privateVariable of privateVariables) {
			this.privateVariables.push(privateVariable)
		}
	}
}

class CellInstance {
	readonly cell:Cell
	position:Vector2D
	constructor(cell:Cell, position:Vector2D) {
		this.cell = cell
		this.position = position
	}
}

const Grid = new (class {
	private _size:Vector2D
	private members:{position:Vector2D, cell:Cell}[] //Change Cell to CellInstance
	constructor(size:Vector2D) {
		this._size = size
		this.members = []
	}

	get width():number{
		return this._size.x
	}

	get height():number{
		return this._size.y
	}

	/*
	!!!!- 
	This is all wrong. A CellInstance class should be created, that is what should actually be added to the grid.
	The Cell class is a blueprint for the cells that will contain rules and on how the CellInstance should behave.
	I will refactor this later 
	!!!!-
	getPosition(cell:Cell):Vector2D|null{
		if (cell.isReference) throw new Error("Cannot get position of a cell that is a reference. Use 'getPositions' instead");
		const member = this.members.find(mem=>mem.cell===cell)
		if (member) return member.position
		return null
	}

	getPositions(cell:Cell):Vector2D[]{
		if (!cell.isReference) throw new Error("Cannot get positions of a cell that is not a reference. Use 'getPosition' instead");
		return this.members.filter(mem=>mem.cell===cell).map(mem=>mem.position)
	}

	cellsAt(pos:Vector2D):Cell[]{
		return this.members.filter(mem=>mem.position.equal(pos)).map(mem=>mem.cell)
	}

	addMember(cell:Cell, position:Vector2D):boolean{
		const cellsAtPosition = this.cellsAt(position)
		if (cellsAtPosition.length > 0) return false
		if (cell.isReference) {
			this.members.push({position, cell})
			return true
		} else {
			
		}
		return false
	}
	*/
})(new Vector2D(30,30));

new Cell({name:'basic'})

console.log(Grid.height)
