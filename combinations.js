exports.allCombination = function allMenuCombinations(
    project,
    menuTree,
    forbidCombs
)  {
    console.time('allMenuCombinations');
    const flatTreeData = flattenMenuTree(project, menuTree, true);
    const shortenedTreeData = shortenNodes(menuTree);
    let data = getCombinations(
        shortenedTreeData.filter((menu) => menu.data.has360),
        project.top_level_rule
    );

    if (isDataSingleDimensional(data)) {
        data = [data];
    }
    let allCombinations = expandNodes(data, flatTreeData);
    flatTreeData.forEach((menuItem, idx, originalArray) => {
        let { forbids } = menuItem.node.data;

        if (forbids.length) {
            forbids = forbids.map((id) => {
                let m = originalArray.find((m) => m.node.id === id);
                if (m?.nomenclature) return m.nomenclature;
            });
            allCombinations = removeForbiddens(allCombinations, menuItem, forbids);
        }
    });

    let configurations = allCombinations.map((comb) => {
        let names = [];
        let noms = [];
        let imgNoms = [];
        const ids = [];
        comb.forEach((menu) => {
            ids.push(menu.node.id);
            names.push('(' + (menu.parentNode?.title ? menu.parentNode.title : '') + '-' + menu.node.title + ')');
            noms.push(menu.nomenclature);
            imgNoms.push(menu.images_nomenclature);
        });
        let configuration = {
            ids,
            externalUrl: undefined,
            names,
            nomenclatures: noms.join('X'),
            images_nomenclature: noms.join('&'),
            price: '',
        };

        return configuration;
    });
    if (forbidCombs && forbidCombs.length) {

        configurations = configurations.filter(
            (config) =>
                !forbidCombs.some((fComb) =>
                    Object.values(fComb).every(
                        (fCol, i) =>
                            !fCol.value ||
                            ((Array.isArray(fCol.value) ||
                                typeof fCol.value === 'string' ||
                                fCol.value instanceof String) &&
                                fCol.value.includes(config.ids[i])) ||
                            fCol.value === config.ids[i]
                    )
                )
        );
    }
    console.timeEnd('allMenuCombinations');

    return configurations;
} // return all possible combinaison after filtered

function flattenMenuTree(project, menus, filter360 = false) {
    const { top_level_rule } = project;
    const rawFlatTree = flattenRawMenus(menus);

    const rawFlatTreeMap = {};
    rawFlatTree.forEach((rawItem) => {
        rawFlatTreeMap[rawItem.node.id] = rawItem;
    });

    // Filtering no 360 images menu
    return rawFlatTree
        .filter(
            (item) => !filter360 || (item.node.data.has360 && (!item.parentNode || item.parentNode.data.has360))
        )
        .map((item) => ({
            node: item.node,
            parentNode: item.parentNode,
            path: item.path,
            level: item.parentNode ? item.path.length - 1 : 0,
            index: item.index,
            parentRule: item.parentNode ? item.parentNode.data.childrenRule : top_level_rule,
            childrenRule:
                item.node.children && item.node.children.length >= 1
                    ? item.node.children[0].data.parentRule
                    : item.parentNode
                    ? item.parentNode.data.childrenRule
                    : top_level_rule,
            isLeaf: !(item.node.children && item.node.children.length >= 1),
            nomenclature: item.path.map((i) => rawFlatTreeMap[i].index).join('_'),
        }));
}

function flattenRawMenus(menuArray, parentNode ) {
    const flatMenuArray = [];

    if (menuArray === undefined || menuArray === null || menuArray.length === 0) return flatMenuArray;

    menuArray.forEach((menu, i) => {
        const flatMenu = {
            node: menu,
            index: i + 1,
            parentNode: parentNode?.node || undefined,
            path: [...(parentNode?.path || []), menu.id],
        };
        flatMenuArray.push(flatMenu, ...flattenRawMenus(menu.children, flatMenu));
    });
    return flatMenuArray;
}

function expandNodes(rawCombinations = null, flatTreeData) {
    if (rawCombinations === null) return null;

    const flatTreeMap = {};
    flatTreeData.forEach((flatNode) => (flatTreeMap[flatNode.node.id] = flatNode));

    return rawCombinations.reduce(function (
        nodes,
        rawCombination
    ) {
        const expandedCombination = rawCombination
            .filter((rawNode) => {
                return rawNode.node.id in flatTreeMap;
            })
            .map(function (rawNode) {
                const flatNode = flatTreeMap[rawNode.node.id];
                return expandFlatNode(flatNode);
            });
        nodes.push(expandedCombination);
        return nodes;
    },
    []);
}

function shortenNodes(menuArray, parent) {
    if (menuArray === null || menuArray === undefined || menuArray.length === 0) return [];

    let imgNomIndex = 1;
    return menuArray.map((menu, index) => {
        const shortNode = shortenMenuNode(menu, index + 1, parent);
        if (!parent && shortNode.data.has360) {
            shortNode.imageNomenclature = '' + imgNomIndex;
            imgNomIndex++;
        }
        return {
            ...shortNode,
            children: shortenNodes(menu.children, shortNode),
        };
    });
}

function removeForbiddens(combinations, menuItem, forbiddenItems) {
    forbiddenItems.forEach((forbiddenNomenclature) => {
        combinations = combinations.filter(
            (combination) =>
                !(
                    combination.map((e) => e.nomenclature).includes(menuItem.nomenclature) &&
                    combination.some((e) => e.nomenclature.startsWith(forbiddenNomenclature))
                )
        );
    });
    return combinations;
} // Forbiddens filter

function removeIfNotContainsMandatory(combinations, mandatoryItem) {
    const mandatoryNomenclature = mandatoryItem.nomenclature;
    // The combination is kept if it contains the mandatory element or at least one item from the mandatory branch (startsWith)
    return combinations.filter((combination) =>
        combination.some((menu) => menu.nomenclature.startsWith(mandatoryNomenclature))
    );
} // Mandatory filter


// The magic is here :)
function getCombinations(menuArray, rule) {
const childCombinations = [];
menuArray.forEach((menu) => {
    if (menu.children === null || menu.children === undefined || menu.children.length === 0) {
        childCombinations.push({ node: { id: menu.id } });
    } else {
        if (rule === 'OR') {
            childCombinations.push(...getCombinations(menu.children, menu.data.childrenRule));
        } else {
            childCombinations.push(getCombinations(menu.children, menu.data.childrenRule));
        }
    }
});

if (rule === 'AND') {
    if (childCombinations.length === 1) {
        return childCombinations[0].map(combination => [combination]);
    }

    const andCombinations = childCombinations.reduce((cumulativeCombinations, childCombination) => {
        if (cumulativeCombinations.length === 0) {
            if (!Array.isArray(childCombination)) {
                return [childCombination];
            }
            return [...childCombination];
        }

        let levelCombinations = [];
        cumulativeCombinations.forEach((cumComb) => {
            if (Array.isArray(childCombination)) {
                childCombination.forEach((comb) => {
                    const combination = [];
                    Array.isArray(cumComb) ? combination.push(...cumComb) : combination.push(cumComb);
                    Array.isArray(comb) ? combination.push(...comb) : combination.push(comb);
                    levelCombinations.push(combination);
                });
            } else {
                const combination = [];
                Array.isArray(cumComb) ? combination.push(...cumComb) : combination.push(cumComb);
                Array.isArray(childCombination) ? combination.push(...childCombination) : combination.push(childCombination);
                levelCombinations.push(combination);
            }
        });

        return levelCombinations;
    }, []);
    return andCombinations;
}
return childCombinations;
}

function isDataSingleDimensional(data)  {
return !Array.isArray(data[0]);
}

function shortenMenuNode(node, index, parent) {
    return {
        id: node.id,
        children: [],
        index,
        nomenclature: parent ? `${parent.nomenclature}_${index}` : `${index}`,
        imageNomenclature: parent?.imageNomenclature ? `${parent.imageNomenclature}_${index}` : undefined,
        data: {
            id: node.data.id,
            childrenRule: node.data.childrenRule,
            parentRule: node.data.parentRule,
            isMandatory: node.data.isMandatory,
            forbids: node.data.forbids,
            has360: node.data.has360,
        },
    };
}

function expandFlatNode(flatNode) {
    return {
        path: flatNode.path,
        level: flatNode.level,
        index: flatNode.index,
        parentRule: flatNode.parentRule,
        childrenRule: flatNode.childrenRule,
        nomenclature: flatNode.nomenclature,
        images_nomenclature: flatNode.node.images_nomenclature,
        title: flatNode.node.title,
        node: {
            id: flatNode.node.id,
            title: flatNode.node.title,
            subtitle: flatNode.node.subtitle,
            children: flatNode.node.children.map(child => expandFlatChild(child)),
            data: {
                id: flatNode.node.data.id,
                childrenRule: flatNode.node.data.childrenRule,
                parentRule: flatNode.node.data.parentRule,
                isMandatory: flatNode.node.data.isMandatory,
                forbids: flatNode.node.data.forbids,
                displayTitle: flatNode.node.data.displayTitle,
                file: flatNode.node.data.file,
                thumbnail: flatNode.node.data.thumbnail,
                productReference: flatNode.node.data.productReference,
                price: flatNode.node.data.price,
            },
        },
        parentNode: {
            id: flatNode.parentNode.id,
            title: flatNode.parentNode.title,
            subtitle: flatNode.parentNode.subtitle,
            children: flatNode.parentNode.children.map(child => expandFlatChild(child)),
            data: {
                id: flatNode.parentNode.data.id,
                childrenRule: flatNode.parentNode.data.childrenRule,
                parentRule: flatNode.parentNode.data.parentRule,
                isMandatory: flatNode.parentNode.data.isMandatory,
                forbids: flatNode.parentNode.data.forbids,
                displayTitle: flatNode.parentNode.data.displayTitle,
                file: flatNode.parentNode.data.file,
                thumbnail: flatNode.parentNode.data.thumbnail,
                productReference: flatNode.parentNode.data.productReference,
                price: flatNode.parentNode.data.price,
            },
            expanded: flatNode.parentNode.expanded,
        },
    };
}

function expandFlatChild(flatChild) {
    return {
        id: flatChild.id,
        title: flatChild.title,
        subtitle: flatChild.subtitle,
        children: flatChild.children.map(child => expandFlatChild(child)),
        data: {
            id: flatChild.data.id,
            childrenRule: flatChild.data.childrenRule,
            parentRule: flatChild.data.parentRule,
            isMandatory: flatChild.data.isMandatory,
            forbids: flatChild.data.forbids,
            displayTitle: flatChild.data.displayTitle,
            file: flatChild.data.file,
            thumbnail: flatChild.data.thumbnail,
            productReference: flatChild.data.productReference,
            price: flatChild.data.price,
        },
    };

}

// console.log(allMenuCombinations(project, menu, forbidden));
