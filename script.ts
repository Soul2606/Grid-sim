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
	private _name:string
	publicVariables:Variable[]
	privateVariables:Variable[]
	readonly isReference:boolean // Reference cells can be at multiple places at once
	readonly isFloating:boolean // Floating cells can overlap with other cells and do not block non floating cells
	constructor({name, publicVariables=[], privateVariables=[], isReference=false, isFloating=false}:{name:string, publicVariables?:Variable[], privateVariables?:Variable[], isReference?:boolean, isFloating?:boolean}) {
		this._name = name
		this.isReference = isReference
		this.isFloating = isFloating
		this.publicVariables = [...publicVariables]
		this.privateVariables = [...privateVariables]
	}

	get name():string{
		return this._name
	}

	set name(str:string){
		if (AllCellClasses.cells.some(val=>val.name === str)) return
		this._name = str
	}
}




class CellInstance {
	readonly cell:Cell
	position:Vector2D
	constructor(cell:Cell, position:Vector2D) {
		this.cell = cell
		this.position = position
	}

	tick(deltaMs:number){
		// user added code is executed here
	}
}




const Grid = new (class {
	private _size:Vector2D
	private members:CellInstance[] //CellInstance has position and other data
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

	set size(vec:Vector2D){
		this._size = vec
	}

	getPosition(cell:CellInstance):Vector2D|null{
		if (cell.cell.isReference) throw new Error("Cannot get position of a cell that is a reference. Use 'getPositions' instead");
		const member = this.members.find(mem=>mem===cell)
		if (member) return member.position
		return null
	}

	getPositions(cell:CellInstance):Vector2D[]{
		if (!cell.cell.isReference) throw new Error("Cannot get positions of a cell that is not a reference. Use 'getPosition' instead");
		return this.members.filter(mem=>mem===cell).map(mem=>mem.position)
	}

	cellsAt(pos:Vector2D):CellInstance[]{
		return this.members.filter(mem=>mem.position.equal(pos))
	}

	addMember(cell:CellInstance, position:Vector2D):boolean{
		const nonFloatingCellsAtPosition = this.cellsAt(position).filter(mem=>!mem.cell.isFloating)
		if (nonFloatingCellsAtPosition.length > 0 && !cell.cell.isFloating) return false
		if (cell.cell.isReference) {
			this.members.push(cell)
			return true
		} else if (!this.members.some(mem=>mem===cell)) {
			this.members.push(cell)
			return true
		}
		return false
	}

	startSimulation(){
		const mainGrid = document.getElementById('main-grid')
		if (!mainGrid) throw new Error("Could not find 'main-grid'");

		removeAllChildren(mainGrid)
		mainGrid.style.gridTemplateColumns = '1fr '.repeat(this.width)
		for (let i = 0; i < this.width * this.height; i++) {
			mainGrid.innerHTML += 
			`
			<div class="grid-cell"></div>
			`
		}
		/*
		let now = Date.now()
		setInterval(() => {
			const deltaMs = Date.now() - now; now = Date.now();			
			for (const member of this.members) {
				member.tick(deltaMs)
			}
		}, 100);
		*/
	}
})(new Vector2D(30,30));




function removeAllChildren(element:HTMLElement):Element[] {
	const removed:Element[] = []
	while (element.firstElementChild) {
		removed.push(element.firstElementChild)
		element.firstElementChild.remove()
	}
	return removed
}




function editableTextModule(element:HTMLElement, callbackFunction:(el:HTMLElement, newText:string, oldText:string)=>void){
	if (element.children.length > 0) {
		console.error(element)
		throw new Error("Element must not have any non text children");
	}
	if (typeof callbackFunction !== 'function') {
		throw new Error("callbackFunction is not a function");
	}
    if (element.contentEditable !== 'true') {
        console.warn(element, `: is not content editable`)
    }

    let shouldRevert = true
    let originalText = element.textContent

    element.addEventListener('focus',e=>{
		e.stopPropagation()
        originalText = element.textContent
    })

    element.addEventListener('blur',()=>{
        if (!shouldRevert) {
            return
        }
        //If revertText
        element.textContent = originalText
    })

    element.addEventListener('keydown',e=>{
        if (e.key !== 'Enter') {
            return
        }
        e.preventDefault()
        callbackFunction(element, element.textContent, originalText)
        originalText = element.textContent
        shouldRevert = false
        element.blur()
    })
    
    element.addEventListener('input',()=>{
        shouldRevert = true
    })
}




const cellClassesListElement = document.getElementById('cell-classes-list'); if (!cellClassesListElement) throw new Error("could not find 'cell-classes-list'");
const newCellButton = document.getElementById('new-cell-button');if (!newCellButton) throw new Error("Could not find 'new-cell-button'");




const AllCellClasses = new (class {
	private _cells:Cell[]
	constructor(){
		this._cells = []
	}

	private updateList(){
		function createCell(cell:Cell) {
			const root = document.createElement('div')
			root.className = 'cell-class'

			const header = document.createElement('div')
			header.className = 'cell-class-header'
			
			const h = document.createElement('h3')		
			h.textContent = cell.name
			h.contentEditable = 'true'
			editableTextModule(h,(el,newText,oldText)=>{
				cell.name = newText
				AllCellClasses.updateList()
			})
			header.appendChild(h)

			const remove = document.createElement('button')
			header.appendChild(remove)
			root.appendChild(header)

			const settings = document.createElement('div')
			settings.className = 'cell-class-settings'
			root.appendChild(settings)

			return root
		}
		removeAllChildren(cellClassesListElement)
		this._cells.map(createCell).forEach(val=>cellClassesListElement.appendChild(val))
	}

	get cells():readonly Cell[]{
		return this._cells
	}

	addCell(cell:Cell):boolean{
		if (this._cells.includes(cell)) return false
		if (this._cells.some(v=>v.name === cell.name)) return false
		this._cells.push(cell)
		this.updateList()
		return true
	}
})()





newCellButton.addEventListener('click', ()=>{
	let i = ''
	while (!AllCellClasses.addCell(new Cell({name:'New thing'+i}))){
		if (i===''){
			i='1'
		}else{
			i=String(Number(i)+1)
		}
	}
	console.log(AllCellClasses.cells)
})




