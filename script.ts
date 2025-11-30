console.log('hello world')




type Variable = {
	name:string
	val:string|number|boolean|null
}




type CellEntry = {
	cell:CellInstance
	position:Vector2D
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
	private _icon:string
	publicVariables:Variable[]
	privateVariables:Variable[]
	isReference:boolean // Reference cells can be at multiple places at once
	isFloating:boolean // Floating cells can overlap with other cells and do not block non floating cells
	private valueChangeCalls:Function[]
	constructor({name, icon, publicVariables=[], privateVariables=[], isReference=false, isFloating=false}:{name:string, icon:string, publicVariables?:Variable[], privateVariables?:Variable[], isReference?:boolean, isFloating?:boolean}) {
		this._name = name
		this._icon = icon
		this.isReference = isReference
		this.isFloating = isFloating
		this.publicVariables = [...publicVariables]
		this.privateVariables = [...privateVariables]
		this.valueChangeCalls = []
	}

	private callChanges() {
		this.valueChangeCalls.forEach(f=>f(this))
	}

	get name():string{
		return this._name
	}

	set name(str:string){
		if (AllCellClasses.cells.some(val=>val.name === str)) return
		this._name = str
		this.callChanges()
	}

	get icon():string{
		return this._icon
	}

	set icon(str:string){
		this._icon = str
		this.callChanges()
	}

	trackChanges(func:(cell:Cell)=>void){
		if (this.valueChangeCalls.includes(func)) return
		this.valueChangeCalls.push(func)
	}
}




class CellInstance {
	readonly cell:Cell
	constructor(cell:Cell) {
		this.cell = cell
	}

	tick(deltaMs:number){
		// user added code is executed here
	}
}




const Grid = new (class {
	private _size:Vector2D
	private entries:CellEntry[]
	constructor(size:Vector2D) {
		this._size = size
		this.entries = []
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
		const member = this.entries.find(ent=>ent.cell===cell)
		if (member) return member.position
		return null
	}

	getPositions(cell:CellInstance):Vector2D[]{
		if (!cell.cell.isReference) throw new Error("Cannot get positions of a cell that is not a reference. Use 'getPosition' instead");
		return this.entries.filter(ent=>ent.cell===cell).map(ent=>ent.position)
	}

	entriesAtPos(pos:Vector2D):CellEntry[]{
		return this.entries.filter(ent=>ent.position.equal(pos))
	}

	setCell(cell:CellInstance, position:Vector2D):boolean{
		const entryAtPosition = this.entriesAtPos(position).find(ent=>!ent.cell.cell.isFloating)
		if (entryAtPosition && !cell.cell.isFloating) {
			this.entries[this.entries.indexOf(entryAtPosition)] = {cell, position}
			return true
		}
		if (cell.cell.isReference) {
			this.entries.push({cell, position})
			return true
		} else {
			this.entries.push({cell, position})
			const entryOfCell = this.entries.find(ent=>ent.cell===cell)
			if (entryOfCell) {
				const indexOFCell = this.entries.indexOf(entryOfCell)
				this.entries.splice(indexOFCell, 1)
			}
			return true
		}
	}

	startSimulation(){
		const mainGrid = document.getElementById('main-grid')
		if (!mainGrid) throw new Error("Could not find 'main-grid'");

		removeAllChildren(mainGrid)
		mainGrid.style.gridTemplateColumns = '1fr '.repeat(this.width)
		for (let i = 0; i < this.width * this.height; i++) {
			const position = new Vector2D(i%this.width, Math.floor(i/this.width))
			const root = document.createElement('div')
			root.className = 'grid-cell'
			root.addEventListener('click',()=>{
				console.log('x', position.x, 'y', position.y)
			})
			mainGrid.appendChild(root)
		}
		/*
		wip
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




// Todo: fix enterOnInput to work with emoji's. the solution probably involves composition and addEventListener("compositionstart") and end
function editableTextModule(element:HTMLElement, callbackFunction:(el:HTMLElement, newText:string, oldText:string)=>void, options:{enterOnInput?:true}={}){
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

	function enterText() {
		callbackFunction(element, element.textContent, originalText)
        originalText = element.textContent
        shouldRevert = false
        element.blur()
	}

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

	if (!options.enterOnInput) {
		element.addEventListener('keydown',e=>{
			if (e.key !== 'Enter') {
				return
			}
			e.preventDefault()
			enterText()
		})
	}
    
    element.addEventListener('input',(e)=>{
		if (options.enterOnInput) {
			enterText()
		}
        shouldRevert = true
    })
}




const cellClassesListElement = document.getElementById('cell-classes-list'); if (!cellClassesListElement) throw new Error("could not find 'cell-classes-list'");
const newCellButton = document.getElementById('new-cell-button');if (!newCellButton) throw new Error("Could not find 'new-cell-button'");
const setBrushButton = document.getElementById('set-brush-button');if (!setBrushButton) throw new Error("Could not find 'set-brush-button'");




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

			const icon = document.createElement('h3')
			icon.textContent = cell.icon
			icon.contentEditable = 'true'
			editableTextModule(icon, (el,newText)=>{
				cell.icon = newText
			})
			cell.trackChanges(()=>{
				icon.textContent = cell.icon
			})
			header.appendChild(icon)
			
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
	while (!AllCellClasses.addCell(new Cell({name:'New thing'+i, icon:'🌲'}))){
		if (i===''){
			i='1'
		}else{
			i=String(Number(i)+1)
		}
	}
	console.log(AllCellClasses.cells)
})



let brushCell:Cell|'empty' = 'empty' as const
{
	let i = -1
	setBrushButton.addEventListener('click',()=>{
		i++
		if (i >= AllCellClasses.cells.length) i = -1
		const cell = AllCellClasses.cells[i]
		if (cell) {
			brushCell = cell
			setBrushButton.textContent = cell.icon
		} else {
			brushCell = 'empty'
		}
		console.log(i)
	})

	for (const cell of AllCellClasses.cells) {
		cell.trackChanges(()=>{
			if (cell.icon === brushCell) setBrushButton.textContent = cell.icon
		})
	}
}


Grid.startSimulation()

