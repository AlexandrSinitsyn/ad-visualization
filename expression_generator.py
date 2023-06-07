from random import randint


def rnd():
    return randint(1, 100)


def rndOf(*lst):
    return lst[randint(0, len(lst) - 1)]


def rndConst():
    return "new FunctionTree.Const(" + str(rnd()) + ")"


def rndVariable():
    return 'new FunctionTree.Variable("' + rndOf('x', 'y', 'z') + '")'


def rndExpr(i):
    rec = rnd()

    if i < 3 and rec > 70:
        return rndBinary(i)
    if i < 3 and rec > 40:
        return rndUnary(i)
    elif rec > 20:
        return rndConst()
    else:
        return rndVariable()
    return '?'


def rndUnary(i):
    name = rnd('Tanh')

    return 'new FunctionTree.' + name + '(' + rndExpr(i + 1) + ')'


def rndBinary(i):
    name = rnd('Add', 'Div')

    return 'new FunctionTree.' + name + '(' + rndExpr(i + 1) + ', ' + rndExpr(i + 1) + ')'


def rndFun():
    return rndExpr(0) + ';'


print(rndFun())
